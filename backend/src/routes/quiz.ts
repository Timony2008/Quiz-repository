import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'

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

async function canRead(quizSetId: number, userId: number) {
  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return null
  if (qs.authorId === userId) return qs
  if ((qs as any).visibility === 'PRIVATE') return false
  return qs
}

async function canEdit(quizSetId: number, userId: number) {
  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return null
  if (qs.authorId === userId) return qs
  if ((qs as any).visibility === 'PUBLIC_EDIT') return qs
  return false
}

// 统一处理 difficulty 输入 → string | null（Prisma SQLite Float? 的实际类型）
function parseDifficulty(raw: any): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = parseFloat(String(raw))
  if (isNaN(n)) return null
  return String(n)
}

// ── GET /quiz — 题库列表 ───────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = (req as any).user!.id
  const quizSets = await prisma.quizSet.findMany({
    where: {
      OR: [
        { authorId: userId },
        { visibility: { in: ['PUBLIC', 'PUBLIC_EDIT'] } } as any
      ]
    },
    include: {
      author: { select: { id: true, username: true } },
      _count: { select: { quizzes: true } }
    },
    orderBy: { id: 'desc' }
  })
  res.json(quizSets)
})

// ── POST /quiz — 创建题库 ──────────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, description, visibility = 'PRIVATE' } = req.body
  if (!title) return res.status(400).json({ error: '标题不能为空' })

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    return res.status(400).json({ error: '无效的权限设置' })
  }

  const quizSet = await prisma.quizSet.create({
    data: {
      title,
      description,
      visibility: visibility as string,
      authorId: (req as any).user!.id
    },
    include: { author: { select: { id: true, username: true } } }
  })
  res.status(201).json(quizSet)
})

// ── GET /quiz/:id — 题库详情 ───────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id

  const access = await canRead(quizSetId, userId)
  if (access === null) return res.status(404).json({ error: '题库不存在' })
  if (access === false) return res.status(403).json({ error: '无权访问' })

  const quizSet = await prisma.quizSet.findUnique({
    where: { id: quizSetId },
    include: {
      author: { select: { id: true, username: true } },
      quizzes: {
        include: { tags: { include: { tag: true } } },
        orderBy: { order: 'asc' }
      }
    }
  })
  res.json(quizSet)
})

// ── DELETE /quiz/batch — 批量删除题目 ─────────────────────────
router.delete('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = (req as any).user!.id
  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids 不能为空' })
  }

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: ids } },
    include: { quizSet: true }
  })

  for (const quiz of quizzes) {
    const qs = quiz.quizSet as any
    const hasPermission = qs.authorId === userId || qs.visibility === 'PUBLIC_EDIT'
    if (!hasPermission) {
      return res.status(403).json({ error: '无权删除部分题目' })
    }
  }

  await prisma.quiz.deleteMany({ where: { id: { in: ids } } })
  res.json({ deleted: ids.length })
})

// ── DELETE /quiz/:id — 删除题库（仅作者）─────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return res.status(404).json({ error: '题库不存在' })
  if (qs.authorId !== userId) return res.status(403).json({ error: '只有作者可以删除题库' })

  await prisma.quizSet.delete({ where: { id: quizSetId } })
  res.json({ message: '删除成功' })
})

// ── PATCH /quiz/:id/visibility — 修改权限（仅作者）───────────
router.patch('/:id/visibility', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id
  const { visibility } = req.body

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    return res.status(400).json({ error: '无效的权限设置' })
  }

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return res.status(404).json({ error: '题库不存在' })
  if (qs.authorId !== userId) return res.status(403).json({ error: '只有作者可以修改权限' })

  const updated = await prisma.quizSet.update({
    where: { id: quizSetId },
    data: { visibility: visibility as string }
  })
  res.json(updated)
})

// ── POST /quiz/:id/items — 添加题目 ───────────────────────────
router.post('/:id/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id

  const access = await canEdit(quizSetId, userId)
  if (access === null) return res.status(404).json({ error: '题库不存在' })
  if (access === false) return res.status(403).json({ error: '无编辑权限' })

  const { question, answer, tags = [] } = req.body
  const difficulty = parseDifficulty(req.body.difficulty)  // ← string | null

  if (!question || !answer) return res.status(400).json({ error: '题目和答案不能为空' })

  const tagIds = tags.length > 0 ? await resolveTagIds(tags) : []

  const quiz = await prisma.quiz.create({
    data: {
      question,
      answer,
      quizSetId,
      difficulty,                                           // ← string | null，Prisma 满意
      tags: {
        create: tagIds.map((tagId: number) => ({ tagId }))
      }
    },
    include: { tags: { include: { tag: true } } }
  })
  res.status(201).json(quiz)
})

// ── PUT /quiz/item/:id — 编辑题目 ─────────────────────────────
router.put('/item/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!quiz) return res.status(404).json({ error: '题目不存在' })

  const access = await canEdit(quiz.quizSetId, userId)
  if (access === false) return res.status(403).json({ error: '无编辑权限' })

  const { question, answer, tags = [] } = req.body
  const difficulty = parseDifficulty(req.body.difficulty)  // ← string | null

  const tagIds = tags.length > 0 ? await resolveTagIds(tags) : []

  await prisma.quizTag.deleteMany({ where: { quizId } })

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      question,
      answer,
      difficulty,                                           // ← string | null，Prisma 满意
      tags: {
        create: tagIds.map((tagId: number) => ({ tagId }))
      }
    },
    include: { tags: { include: { tag: true } } }
  })
  res.json(updated)
})

// ── DELETE /quiz/item/:id — 删除题目 ──────────────────────────
router.delete('/item/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizId = parseInt(String(req.params.id))
  const userId = (req as any).user!.id

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!quiz) return res.status(404).json({ error: '题目不存在' })

  const access = await canEdit(quiz.quizSetId, userId)
  if (access === false) return res.status(403).json({ error: '无编辑权限' })

  await prisma.quiz.delete({ where: { id: quizId } })
  res.json({ message: '删除成功' })
})

// ── POST /quiz/reorder — 批量更新题目顺序 ────────────────────────
router.post('/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = (req as any).user!.id
  const items: { id: number; order: number }[] = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items 不能为空' })
  }

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: items.map(i => i.id) } },
    include: { quizSet: true }
  })

  for (const quiz of quizzes) {
    const qs = quiz.quizSet as any
    const hasPermission = qs.authorId === userId || qs.visibility === 'PUBLIC_EDIT'
    if (!hasPermission) return res.status(403).json({ error: '无权排序' })
  }

  await prisma.$transaction(
    items.map(({ id, order }) =>
      prisma.quiz.update({ where: { id }, data: { order } })
    )
  )

  res.json({ updated: items.length })
})

export default router
