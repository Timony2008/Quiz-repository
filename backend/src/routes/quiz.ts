import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { resolveTagIds } from '../services/tagService'

const router = Router()
const prisma = new PrismaClient()

// ── 权限辅助 ──────────────────────────────────────────────────
async function canRead(quizSetId: number, userId: number) {
  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return null
  if (qs.authorId === userId) return qs
  if (qs.visibility === 'PRIVATE') return false
  return qs
}

async function canEdit(quizSetId: number, userId: number) {
  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) return null
  if (qs.authorId === userId) return qs
  if (qs.visibility === 'PUBLIC_EDIT') return qs
  return false
}

// ── difficulty 解析 ───────────────────────────────────────────
function parseDifficulty(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = parseFloat(String(raw))
  return isNaN(n) ? null : n
}

// ── GET /quiz — 题库列表，支持标签名模糊筛选 ─────────────────
// ?tags=多项式,构造   （逗号分隔，取交集）
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const tagParam = req.query.tags ? String(req.query.tags) : null

  let quizIdFilter: number[] | undefined

  if (tagParam) {
    const names = tagParam.split(',').map(s => s.trim()).filter(Boolean)

    // 每个名字：全局标签优先，找不到就跳过（不再区分 dimension）
    const tagResults = await Promise.all(
      names.map(name =>
        prisma.tag.findFirst({
          where: {
            name,
            OR: [
              { isGlobal: true },
              { quizSet: { authorId: userId } },
            ]
          }
        })
      )
    )

    // 任意标签不存在 → 交集为空
    if (tagResults.some(t => t === null)) {
      res.json([]); return
    }

    // 对每个 tagId 取关联 quizId，最终取交集
    const quizIdSets = await Promise.all(
      tagResults.map(tag =>
        prisma.quizTag
          .findMany({ where: { tagId: tag!.id }, select: { quizId: true } })
          .then(rows => new Set(rows.map(r => r.quizId)))
      )
    )

    const intersection = quizIdSets.reduce(
      (acc, cur) => new Set([...acc].filter(id => cur.has(id)))
    )

    quizIdFilter = [...intersection]
    if (quizIdFilter.length === 0) { res.json([]); return }
  }

  const quizSets = await prisma.quizSet.findMany({
    where: {
      OR: [
        { authorId: userId },
        { visibility: { in: ['PUBLIC', 'PUBLIC_EDIT'] } },
      ],
      ...(quizIdFilter !== undefined && {
        quizzes: { some: { id: { in: quizIdFilter } } }
      })
    },
    include: {
      author: { select: { id: true, username: true } },
      _count:  { select: { quizzes: true } },
    },
    orderBy: { id: 'desc' },
  })

  res.json(quizSets)
})

// ── POST /quiz — 创建题库 ─────────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, description, visibility = 'PRIVATE' } = req.body
  if (!title) { res.status(400).json({ error: '标题不能为空' }); return }

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    res.status(400).json({ error: '无效的权限设置' }); return
  }

  const quizSet = await prisma.quizSet.create({
    data: {
      title,
      description,
      visibility,
      authorId: req.userId!,
    },
    include: { author: { select: { id: true, username: true } } },
  })
  res.status(201).json(quizSet)
})

// ── GET /quiz/:id — 题库详情 ──────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId    = req.userId!

  const access = await canRead(quizSetId, userId)
  if (access === null)  { res.status(404).json({ error: '题库不存在' }); return }
  if (access === false) { res.status(403).json({ error: '无权访问' });   return }

  const quizSet = await prisma.quizSet.findUnique({
    where:   { id: quizSetId },
    include: {
      author:  { select: { id: true, username: true } },
      quizzes: {
        include: {
          tags: {
            include: { tag: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
  res.json(quizSet)
})

// ── DELETE /quiz/batch — 批量删除题目 ────────────────────────
router.delete('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids 不能为空' }); return
  }

  const quizzes = await prisma.quiz.findMany({
    where:   { id: { in: ids } },
    include: { quizSet: true },
  })

  for (const quiz of quizzes) {
    const qs = quiz.quizSet
    const ok = qs.authorId === userId || qs.visibility === 'PUBLIC_EDIT'
    if (!ok) { res.status(403).json({ error: '无权删除部分题目' }); return }
  }

  await prisma.quiz.deleteMany({ where: { id: { in: ids } } })
  res.json({ deleted: ids.length })
})

// ── DELETE /quiz/:id — 删除题库（仅作者）────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId    = req.userId!

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs)                   { res.status(404).json({ error: '题库不存在' });       return }
  if (qs.authorId !== userId) { res.status(403).json({ error: '只有作者可以删除题库' }); return }

  await prisma.quizSet.delete({ where: { id: quizSetId } })
  res.json({ message: '删除成功' })
})

// ── PATCH /quiz/:id/visibility — 修改权限（仅作者）──────────
router.patch('/:id/visibility', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId    = req.userId!
  const { visibility } = req.body

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    res.status(400).json({ error: '无效的权限设置' }); return
  }

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs)                   { res.status(404).json({ error: '题库不存在' });         return }
  if (qs.authorId !== userId) { res.status(403).json({ error: '只有作者可以修改权限' }); return }

  const updated = await prisma.quizSet.update({
    where: { id: quizSetId },
    data:  { visibility },
  })
  res.json(updated)
})

// ── POST /quiz/:id/items — 添加题目 ──────────────────────────
router.post('/:id/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId    = req.userId!

  const access = await canEdit(quizSetId, userId)
  if (access === null)  { res.status(404).json({ error: '题库不存在' }); return }
  if (access === false) { res.status(403).json({ error: '无编辑权限' }); return }

  const { question, answer, tags = [] } = req.body
  const difficulty = parseDifficulty(req.body.difficulty)

  if (!question || !answer) {
    res.status(400).json({ error: '题目和答案不能为空' }); return
  }

  // resolveTagIds 新签名：需要传 quizSetId
  const tagIds = tags.length > 0 ? await resolveTagIds(tags, quizSetId) : []

  const quiz = await prisma.quiz.create({
    data: {
      question,
      answer,
      quizSetId,
      difficulty,
      tags: {
        create: tagIds.map((tagId: number) => ({ tagId })),
      },
    },
    include: {
      tags: { include: { tag: true }, orderBy: { order: 'asc' } },
    },
  })
  res.status(201).json(quiz)
})

// ── PUT /quiz/item/:id — 编辑题目 ────────────────────────────
router.put('/item/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizId = parseInt(String(req.params.id))
  const userId = req.userId!

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!quiz) { res.status(404).json({ error: '题目不存在' }); return }

  const access = await canEdit(quiz.quizSetId, userId)
  if (access === false) { res.status(403).json({ error: '无编辑权限' }); return }

  const { question, answer, tags = [] } = req.body
  const difficulty = parseDifficulty(req.body.difficulty)

  // resolveTagIds 新签名：需要传 quizSetId
  const tagIds = tags.length > 0 ? await resolveTagIds(tags, quiz.quizSetId) : []

  await prisma.quizTag.deleteMany({ where: { quizId } })

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      question,
      answer,
      difficulty,
      tags: {
        create: tagIds.map((tagId: number) => ({ tagId })),
      },
    },
    include: {
      tags: { include: { tag: true }, orderBy: { order: 'asc' } },
    },
  })
  res.json(updated)
})

// ── PATCH /quiz/:id/items/reorder — 题目排序 ─────────────────
// body: { orders: [{ id: number, order: number }] }
router.patch('/:id/items/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId    = req.userId!

  const access = await canEdit(quizSetId, userId)
  if (access === null)  { res.status(404).json({ error: '题库不存在' }); return }
  if (access === false) { res.status(403).json({ error: '无编辑权限' }); return }

  const { orders } = req.body as { orders: { id: number; order: number }[] }
  if (!Array.isArray(orders)) {
    res.status(400).json({ error: 'orders 格式错误' }); return
  }

  await Promise.all(
    orders.map(({ id, order }) =>
      prisma.quiz.update({ where: { id }, data: { order } })
    )
  )
  res.json({ updated: orders.length })
})

export default router
