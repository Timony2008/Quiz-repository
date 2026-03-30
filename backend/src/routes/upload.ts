import { Router, Response } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { parseTexFile } from '../services/texParser'
import { parsePdfFile } from '../services/pdfParser'
import type { QAPairWithTags } from '../services/aiParser'

const router = Router()
const prisma = new PrismaClient()

// ── Multer 配置 ──────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.tex', '.pdf'].includes(ext)) cb(null, true)
    else cb(new Error('只支持 .tex 和 .pdf 文件'))
  },
})

// ── 小工具：去重字符串数组 ────────────────────────────────────
function uniqStr(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))]
}

// ── 将 AI 推断的标签写入 QuizTag ──────────────────────────────
// 新规则：
// 1) knowledge/method/source 只匹配“已有全局标签”，不自动创建
// 2) proposedContext：先匹配全局，不存在则在当前题库创建私有 CONTEXT（isGlobal=false）
async function applyAITags(
  quizId: number,
  quizSetId: number,
  tags: QAPairWithTags['tags']
) {
  const tagIds: number[] = []

  // 1) 三类字典标签：仅全局匹配，不创建
  const globalNames = uniqStr([
    ...(tags.knowledge ?? []),
    ...(tags.method ?? []),
    ...(tags.source ? [tags.source] : []),
  ])

  for (const name of globalNames) {
    const tag = await prisma.tag.findFirst({
      where: { name, isGlobal: true },
      select: { id: true },
    })
    if (tag) {
      tagIds.push(tag.id)
    } else {
      console.warn(`[AI Tags] 全局标签不存在，已跳过: ${name}`)
    }
  }

  // 2) 自由候选标签 proposedContext：全局优先，否则创建题库私有
  // 兼容旧字段 context（防止历史数据）
  const rawContext = Array.isArray((tags as any).proposedContext)
    ? (tags as any).proposedContext
    : (Array.isArray((tags as any).context) ? (tags as any).context : [])

  const contextNames = uniqStr(rawContext.map((x: any) => String(x)))

  for (const name of contextNames) {
    // 2.1 先找全局 CONTEXT
    let tag = await prisma.tag.findFirst({
      where: { name, dimension: 'CONTEXT', isGlobal: true },
      select: { id: true },
    })

    // 2.2 找不到再找本题库私有 CONTEXT
    if (!tag) {
      tag = await prisma.tag.findFirst({
        where: { name, dimension: 'CONTEXT', isGlobal: false, quizSetId },
        select: { id: true },
      })
    }

    // 2.3 还没有则创建“私有 CONTEXT”
    if (!tag) {
      const created = await prisma.tag.create({
        data: {
          name,
          dimension: 'CONTEXT',
          isGlobal: false,
          quizSetId,
        },
        select: { id: true },
      })
      tag = created
    }

    tagIds.push(tag.id)
  }

  // 3) 关联 QuizTag（去重）
  const uniqueIds = [...new Set(tagIds)]
  for (const tagId of uniqueIds) {
    await prisma.quizTag.upsert({
      where: { quizId_tagId: { quizId, tagId } },
      create: { quizId, tagId },
      update: {},
    })
  }
}

// ── 权限检查 ──────────────────────────────────────────────────
async function canEdit(quizSetId: number, userId: number) {
  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return false
  if (qs.authorId === userId) return true
  if (qs.visibility === 'PUBLIC_EDIT') return true
  return false
}

// ── POST /api/upload — 上传并异步解析写库 ───────────────────
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传文件' })
    return
  }

  const quizSetId = Number(req.body.quizSetId)
  if (!Number.isInteger(quizSetId) || quizSetId <= 0) {
    res.status(400).json({ error: '请指定有效的目标题库' })
    return
  }

  if (!(await canEdit(quizSetId, req.userId!))) {
    res.status(403).json({ error: '无权操作该题库' })
    return
  }

  const { originalname, path: storedPath } = req.file
  const ext = path.extname(originalname).toLowerCase()
  const fileType = ext === '.pdf' ? 'PDF' : 'TEX'

  const sourceFile = await prisma.sourceFile.create({
    data: { filename: originalname, storedPath, fileType, status: 'PROCESSING' },
  })

  res.json({ message: '上传成功，正在解析...', sourceFileId: sourceFile.id })

  // 异步处理
  ;(async () => {
    try {
      let parsed: QAPairWithTags[] = []

      if (fileType === 'TEX') {
        const content = fs.readFileSync(storedPath, 'utf-8')
        parsed = (await parseTexFile(content)) as QAPairWithTags[]
      } else {
        parsed = (await parsePdfFile(storedPath)) as QAPairWithTags[]
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        await prisma.sourceFile.update({
          where: { id: sourceFile.id },
          data: { status: 'FAILED', errorMsg: '未能从文件中解析出题目，请检查格式' },
        })
        return
      }

      for (const q of parsed) {
        const quiz = await prisma.quiz.create({
          data: {
            question: String(q.question ?? '').trim(),
            answer: String(q.answer ?? '').trim(), // 允许空答案
            quizSetId,
            sourceFileId: sourceFile.id,
          },
        })

//目前我们把AI打标签功能删掉了，因为AI实在有点唐氏，误伤率太高，反而增加了人工整理的工作量。后续我们会考虑重做一个更可靠的标签系统，或者提供一个独立的“AI推荐标签”功能，让用户自己选择是否采纳。
      }

      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data: { status: 'DONE', quizCount: parsed.length },
      })
    } catch (err) {
      console.error('解析失败:', err)
      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data: {
          status: 'FAILED',
          errorMsg: err instanceof Error ? err.message : String(err),
        },
      })
    }
  })()
})

// ── GET /api/upload/status/:id — 查询解析状态 ───────────────
router.get('/status/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const sourceFile = await prisma.sourceFile.findUnique({ where: { id } })
  if (!sourceFile) {
    res.status(404).json({ error: '记录不存在' })
    return
  }
  res.json(sourceFile)
})

export default router
