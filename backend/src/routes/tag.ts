import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// ── DELETE /api/tag/:id — 删除标签（不删题目）─────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId = parseInt(String(req.params.id))

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag) return res.status(404).json({ error: '标签不存在' })

  // QuizTag 没有 onDelete: Cascade，需手动先删关联
  await prisma.quizTag.deleteMany({ where: { tagId } })
  await prisma.tag.delete({ where: { id: tagId } })

  res.json({ message: '标签已删除' })
})

// ── POST /api/tag — 创建标签 ──────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: '标签名不能为空' })

  const existing = await prisma.tag.findUnique({ where: { name: name.trim() } })
  if (existing) return res.status(409).json({ error: '标签已存在', tag: existing })

  const tag = await prisma.tag.create({ data: { name: name.trim() } })
  res.status(201).json(tag)
})

// ── POST /api/tag/:id/attach — 批量关联题目到标签 ─────────────
router.post('/:id/attach', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId = parseInt(String(req.params.id))
  const { quizIds } = req.body

  if (!Array.isArray(quizIds) || quizIds.length === 0) {
    return res.status(400).json({ error: 'quizIds 不能为空' })
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag) return res.status(404).json({ error: '标签不存在' })

  // upsert 逐条写入，跳过已存在的关联
  await Promise.all(
    quizIds.map((quizId: number) =>
      prisma.quizTag.upsert({
        where: { quizId_tagId: { quizId, tagId } },
        create: { quizId, tagId },
        update: {}
      })
    )
  )

  res.json({ attached: quizIds.length })
})

export default router
