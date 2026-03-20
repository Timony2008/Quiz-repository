import { Router, Response } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { parseTexFile } from '../services/texParser'
import { parsePdfFile } from '../services/pdfParser'
import { QAPairWithTags } from '../services/aiParser'

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
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.tex', '.pdf'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 .tex 和 .pdf 文件'))
    }
  }
})

// ── 将 AI 推断的标签写入 QuizTag ──────────────────────────────
// 新逻辑：全部改为按 isGlobal 匹配，不再依赖 dimension
async function applyAITags(
  quizId: number,
  quizSetId: number,
  tags: QAPairWithTags['tags']
) {
  const tagIds: number[] = []

  // ── 全局标签匹配（knowledge / method / source）─────────────
  // 只从已有全局标签中匹配，找不到则跳过（不自动创建）
  const globalNames = [
    ...(tags.knowledge ?? []),
    ...(tags.method    ?? []),
    ...(tags.source    ? [tags.source] : []),
  ]

  for (const name of globalNames) {
    const tag = await prisma.tag.findFirst({
      where: { name, isGlobal: true }
    })
    if (tag) {
      tagIds.push(tag.id)
    } else {
      console.warn(`[AI Tags] 全局标签不存在，跳过: ${name}`)
    }
  }

  // ── 自由标签（context）─────────────────────────────────────
  // 全局优先匹配；全局没有则在题库内创建私有标签
  for (const name of tags.context ?? []) {
    let tag = await prisma.tag.findFirst({
      where: { name, dimension: 'CONTEXT', isGlobal: true }
    })
    if (!tag) {
      tag = await prisma.tag.create({
        data: { name, dimension: 'CONTEXT', isGlobal: true, quizSetId: null }
      })
    }
    tagIds.push(tag.id)
  }

  // ── 去重后批量写入 QuizTag ────────────────────────────────
  const uniqueIds = [...new Set(tagIds)]
  for (const tagId of uniqueIds) {
    await prisma.quizTag.upsert({
      where:  { quizId_tagId: { quizId, tagId } },
      create: { quizId, tagId },
      update: {}
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

  const quizBankId = parseInt(req.body.quizSetId)
  if (!quizBankId) {
    res.status(400).json({ error: '请指定目标题库' })
    return
  }

  if (!await canEdit(quizBankId, req.userId!)) {
    res.status(403).json({ error: '无权操作该题库' })
    return
  }

  const { originalname, path: storedPath } = req.file
  const ext      = path.extname(originalname).toLowerCase()
  const fileType = ext === '.pdf' ? 'PDF' : 'TEX'

  const sourceFile = await prisma.sourceFile.create({
    data: { filename: originalname, storedPath, fileType, status: 'PROCESSING' }
  })

  res.json({ message: '上传成功，正在解析...', sourceFileId: sourceFile.id })

  // ── 异步解析，不阻塞响应 ──────────────────────────────────
  ;(async () => {
    try {
      let parsed: QAPairWithTags[] = []

      if (fileType === 'TEX') {
        const content = fs.readFileSync(storedPath, 'utf-8')
        parsed = await parseTexFile(content) as QAPairWithTags[]
      } else {
        parsed = await parsePdfFile(storedPath) as QAPairWithTags[]
      }

      console.log('>>> parsed.length =', parsed.length)
      console.log('>>> parsed[0] =', JSON.stringify(parsed[0]))

      if (parsed.length === 0) {
        await prisma.sourceFile.update({
          where: { id: sourceFile.id },
          data:  { status: 'FAILED', errorMsg: '未能从文件中解析出题目，请检查格式' }
        })
        return
      }

      for (const q of parsed) {
        const quiz = await prisma.quiz.create({
          data: {
            question:     q.question,
            answer:       q.answer,
            quizSetId:    quizBankId,
            sourceFileId: sourceFile.id
          }
        })

        if (q.tags) {
          try {
            await applyAITags(quiz.id, quizBankId, q.tags)
          } catch (tagErr) {
            console.error(`[AI Tags] quizId=${quiz.id} 标签写入失败:`, tagErr)
          }
        }
      }

      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data:  { status: 'DONE', quizCount: parsed.length }
      })

    } catch (err) {
      console.error('解析失败:', err)
      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data:  {
          status:   'FAILED',
          errorMsg: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })()
})

// ── GET /api/upload/status/:id — 查询解析状态 ───────────────
router.get('/status/:id', async (req: AuthRequest, res: Response) => {
  const id         = parseInt(req.params.id as string)
  const sourceFile = await prisma.sourceFile.findUnique({ where: { id } })
  if (!sourceFile) {
    res.status(404).json({ error: '记录不存在' })
    return
  }
  res.json(sourceFile)
})

export default router
