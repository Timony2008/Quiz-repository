import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()


async function resolveTagIds(tagNames: string[]): Promise<number[]> {
  const tags = await Promise.all(
    tagNames.map(name =>
      prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {}
      })
    )
  )
  return tags.map(t => t.id)
}

// ✅ /tags/all 必须在 /:id 之前
router.get('/tags/all', async (_req: AuthRequest, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    res.json(tags)
  } catch {
    res.status(500).json({ error: '获取标签失败' })
  }
})

// ✅ /filter 在 /:id 之前
router.get('/filter', async (req: AuthRequest, res: Response) => {
  try {
    const { tag } = req.query
    const quizSets = await prisma.quizSet.findMany({
      where: tag
        ? {
            quizzes: {
              some: {
                tags: { some: { tag: { name: String(tag) } } }
              }
            }
          }
        : undefined,
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { quizzes: true } },
        tags: { include: { tag: true } }
      }
    })
    res.json(quizSets)
  } catch {
    res.status(500).json({ error: '筛选失败' })
  }
})

// ✅ /item/:quizId 在 /:id 之前，避免被 /:id 拦截
// ─── 单题：编辑 ──────────────────────────────────────────────────────
router.put('/item/:quizId', async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.quizId)
    const { question, answer, tags } = req.body

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { quizSet: true }
    })
    if (!quiz) { res.status(404).json({ error: '题目不存在' }); return }
    if (!quiz.quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    console.log('req.userId:', req.userId, typeof req.userId)
    console.log('authorId:', quiz.quizSet.authorId, typeof quiz.quizSet.authorId)
    
    if (Number(quiz.quizSet.authorId) !== Number(req.userId)) { res.status(403).json({ error: '无权限' }); return }
    
    if (tags !== undefined) {
      const tagIds = tags.length ? await resolveTagIds(tags) : []
      await prisma.tagOnQuiz.deleteMany({ where: { quizId } })
      if (tagIds.length) {
        await prisma.tagOnQuiz.createMany({
          data: tagIds.map((tagId: number) => ({ quizId, tagId }))
        })
      }
    }

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        question: String(question),
        answer: String(answer)
      },
      include: { tags: { include: { tag: true } } }
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: '更新失败' })
  }
})

// ─── 单题：删除 ──────────────────────────────────────────────────────
router.delete('/item/:quizId', async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.quizId)

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { quizSet: true }
    })
    if (!quiz) { res.status(404).json({ error: '题目不存在' }); return }
    if (!quiz.quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (Number(quiz.quizSet.authorId) !== Number(req.userId)) { res.status(403).json({ error: '无权限' }); return }

    await prisma.tagOnQuiz.deleteMany({ where: { quizId } })
    await prisma.quiz.delete({ where: { id: quizId } })
    res.json({ message: '删除成功' })
  } catch {
    res.status(500).json({ error: '删除失败' })
  }
})

// ─── 题库列表 ─────────────────────────────────────────────────────────
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const quizSets = await prisma.quizSet.findMany({
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { quizzes: true } },
        tags: { include: { tag: true } }
      }
    })
    res.json(quizSets)
  } catch {
    res.status(500).json({ error: '获取失败' })
  }
})

// ─── 题库详情 ─────────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const quizSet = await prisma.quizSet.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        author: { select: { id: true, username: true } },
        quizzes: { include: { tags: { include: { tag: true } } } },
        tags: { include: { tag: true } }
      }
    })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    res.json(quizSet)
  } catch {
    res.status(500).json({ error: '获取失败' })
  }
})

// ─── 新建题库 ─────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, tags } = req.body
    const tagIds = tags?.length ? await resolveTagIds(tags) : []

    const quizSet = await prisma.quizSet.create({
      data: {
        title: String(title),
        description: description ? String(description) : undefined,
        authorId: req.userId!
      }
    })

    if (tagIds.length) {
      await prisma.tagOnQuizSet.createMany({
        data: tagIds.map(tagId => ({ quizSetId: quizSet.id, tagId }))
      })
    }

    const result = await prisma.quizSet.findUnique({
      where: { id: quizSet.id },
      include: { tags: { include: { tag: true } } }
    })
    res.json(result)
  } catch {
    res.status(500).json({ error: '创建失败' })
  }
})

// ─── 编辑题库 ─────────────────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const quizSet = await prisma.quizSet.findUnique({
      where: { id: Number(req.params.id) }
    })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (Number(quizSet.authorId) !== Number(req.userId)) { res.status(403).json({ error: '无权限' }); return }

    const { title, description, tags } = req.body

    if (tags !== undefined) {
      const tagIds = tags.length ? await resolveTagIds(tags) : []
      await prisma.tagOnQuizSet.deleteMany({ where: { quizSetId: quizSet.id } })
      if (tagIds.length) {
        await prisma.tagOnQuizSet.createMany({
          data: tagIds.map(tagId => ({ quizSetId: quizSet.id, tagId }))
        })
      }
    }

    const updated = await prisma.quizSet.update({
      where: { id: Number(req.params.id) },
      data: {
        title: String(title),
        description: description ? String(description) : undefined
      },
      include: { tags: { include: { tag: true } } }
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: '更新失败' })
  }
})

// ─── 删除题库 ─────────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const quizSet = await prisma.quizSet.findUnique({
      where: { id: Number(req.params.id) }
    })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (Number(quizSet.authorId) !== Number(req.userId)) { res.status(403).json({ error: '无权限' }); return }

    await prisma.tagOnQuizSet.deleteMany({ where: { quizSetId: quizSet.id } })
    await prisma.quizSet.delete({ where: { id: Number(req.params.id) } })
    res.json({ message: '删除成功' })
  } catch {
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
