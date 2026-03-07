import { Router, Response } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { parseTexFile } from '../services/texParser'
import { parsePdfFile } from '../services/pdfParser'

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

// ── 上传接口 ──────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传文件' })
    return
  }

  const quizBankId = parseInt(req.body.quizSetId)
  if (!quizBankId) {
    res.status(400).json({ error: '请指定目标题库' })
    return
  }

  const { originalname, path: storedPath } = req.file
  const ext = path.extname(originalname).toLowerCase()
  const fileType = ext === '.pdf' ? 'PDF' : 'TEX'

  const sourceFile = await prisma.sourceFile.create({
    data: {
      filename: originalname,
      storedPath,
      fileType,
      status: 'PROCESSING'
    }
  })

  res.json({ message: '上传成功，正在解析...', sourceFileId: sourceFile.id })

  // 异步解析，不阻塞响应
  ;(async () => {
    try {
      let parsed: { question: string; answer: string }[] = []

      if (fileType === 'TEX') {
        const content = fs.readFileSync(storedPath, 'utf-8')
        parsed = parseTexFile(content)
      } else {
        parsed = await parsePdfFile(storedPath)
      }

      if (parsed.length === 0) {
        await prisma.sourceFile.update({
          where: { id: sourceFile.id },
          data: {
            status: 'FAILED',
            errorMsg: '未能从文件中解析出题目，请检查格式'
          }
        })
        return
      }

      await prisma.$transaction(
        parsed.map(q =>
          prisma.quiz.create({
            data: {
              question: q.question,
              answer: q.answer,
              authorId: req.userId!,
              sourceFileId: sourceFile.id,
              quizSetId: quizBankId   // ✅ 关键修复：题目归属到指定题库
            }
          })
        )
      )

      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data: { status: 'DONE', quizCount: parsed.length }
      })
    } catch (err) {
      console.error('解析失败:', err)
      await prisma.sourceFile.update({
        where: { id: sourceFile.id },
        data: {
          status: 'FAILED',
          errorMsg: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })()
})

// ── 查询解析状态 ──────────────────────────────────────────────
router.get('/status/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string)
  const sourceFile = await prisma.sourceFile.findUnique({ where: { id } })
  if (!sourceFile) {
    res.status(404).json({ error: '记录不存在' })
    return
  }
  res.json(sourceFile)
})

export default router
