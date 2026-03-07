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

// ✅ 1. 具体路径：/tags/all
router.get('/tags/all', async (_req: AuthRequest, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    res.json(tags)
  } catch (err) {
    res.status(500).json({ error: '获取标签失败' })
  }
})

// ✅ 2. 具体路径：/item 相关（必须在 /:id 之前）
router.post('/item', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { question, answer, quizSetId, tags } = req.body
    if (!question || !answer || !quizSetId) {
      res.status(400).json({ error: '缺少必要字段' }); return
    }

    const quizSet = await prisma.quizSet.findUnique({ where: { id: Number(quizSetId) } })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (quizSet.authorId !== req.userId) { res.status(403).json({ error: '无权限' }); return }

    const tagIds = tags?.length ? await resolveTagIds(tags) : []

    const quiz = await prisma.quiz.create({
      data: {
        question,
        answer,
        quizSetId: Number(quizSetId),
        tags: {
          create: tagIds.map((tagId: number) => ({ tagId }))
        }
      } as any,
      include: { tags: { include: { tag: true } } }
    })
    res.status(201).json(quiz)
  } catch (err) {
    res.status(500).json({ error: '创建题目失败' })
  }
})

router.put('/item/:quizId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.quizId)
    const { question, answer, tags } = req.body

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { quizSet: true }
    })
    if (!quiz) { res.status(404).json({ error: '题目不存在' }); return }
    if (!quiz.quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (quiz.quizSet.authorId !== req.userId) { res.status(403).json({ error: '无权限' }); return }

    const tagIds = tags?.length ? await resolveTagIds(tags) : []

    await prisma.tagOnQuiz.deleteMany({ where: { quizId } })

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        question,
        answer,
        tags: {
          create: tagIds.map((tagId: number) => ({ tagId }))
        }
      },
      include: { tags: { include: { tag: true } } }
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: '更新题目失败' })
  }
})

router.delete('/item/:quizId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const quizId = Number(req.params.quizId)
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { quizSet: true }
    })
    if (!quiz) { res.status(404).json({ error: '题目不存在' }); return }
    if (!quiz.quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (quiz.quizSet.authorId !== req.userId) { res.status(403).json({ error: '无权限' }); return }

    await prisma.tagOnQuiz.deleteMany({ where: { quizId } })
    await prisma.quiz.delete({ where: { id: quizId } })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: '删除题目失败' })
  }
})

// ✅ 3. 通配路径：/:id 相关（放最后）
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const quizSets = await prisma.quizSet.findMany({
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { quizzes: true } }
      },
      orderBy: { id: 'desc' }
    })
    res.json(quizSets)
  } catch (err) {
    res.status(500).json({ error: '获取题库失败' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body
    if (!title) { res.status(400).json({ error: '标题不能为空' }); return }

    const quizSet = await prisma.quizSet.create({
      data: {
        title,
        description,
        authorId: req.userId!
      }
    })
    res.status(201).json(quizSet)
  } catch (err) {
    console.error('创建题库失败:', err)
    res.status(500).json({ error: '创建题库失败' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const quizSet = await prisma.quizSet.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        quizzes: {
          include: {
            tags: { include: { tag: true } }
          }
        }
      }
    })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    res.json(quizSet)
  } catch (err) {
    res.status(500).json({ error: '获取题库失败' })
  }
})

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { title, description } = req.body

    const quizSet = await prisma.quizSet.findUnique({ where: { id } })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (quizSet.authorId !== req.userId) { res.status(403).json({ error: '无权限' }); return }

    const updated = await prisma.quizSet.update({
      where: { id },
      data: { title, description }
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: '更新题库失败' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const quizSet = await prisma.quizSet.findUnique({ where: { id } })
    if (!quizSet) { res.status(404).json({ error: '题库不存在' }); return }
    if (quizSet.authorId !== req.userId) { res.status(403).json({ error: '无权限' }); return }

    await prisma.tagOnQuiz.deleteMany({ where: { quiz: { quizSetId: id } } })
    await prisma.quiz.deleteMany({ where: { quizSetId: id } })
    await prisma.quizSet.delete({ where: { id } })
    res.json({ message: '删除成功' })
  } catch (err) {
    res.status(500).json({ error: '删除题库失败' })
  }
})

export default router
