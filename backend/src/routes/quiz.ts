import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { resolveTagDecision } from '../services/tagService'

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

function parseDifficulty(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = parseFloat(String(raw))
  return Number.isNaN(n) ? null : n
}

function normalizeNote(raw: any): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}

function toNumberArray(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  return [...new Set(
    input
      .map(v => Number(v))
      .filter((n): n is number => Number.isInteger(n) && n > 0)
  )]
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return [...new Set(
    input
      .map(v => String(v).trim())
      .filter(Boolean)
  )]
}

// ── GET /quiz — 题库列表 ─────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const tagParam = req.query.tags ? String(req.query.tags) : null

  let quizIdFilter: number[] | undefined

  if (tagParam) {
    const names = tagParam.split(',').map(s => s.trim()).filter(Boolean)

    const tagResults = await Promise.all(
      names.map(name =>
        prisma.tag.findFirst({
          where: {
            name,
            OR: [{ isGlobal: true }, { quizSet: { authorId: userId } }],
          },
        })
      )
    )

    if (tagResults.some(t => t === null)) {
      res.json([])
      return
    }

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
    if (quizIdFilter.length === 0) {
      res.json([])
      return
    }
  }

  const quizSets = await prisma.quizSet.findMany({
    where: {
      OR: [{ authorId: userId }, { visibility: { in: ['PUBLIC', 'PUBLIC_EDIT'] } }],
      ...(quizIdFilter !== undefined && { quizzes: { some: { id: { in: quizIdFilter } } } }),
    },
    include: {
      author: { select: { id: true, username: true } },
      _count: { select: { quizzes: true } },
    },
    orderBy: { id: 'desc' },
  })

  res.json(quizSets)
})

// ── POST /quiz — 创建题库 ─────────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, description, visibility = 'PRIVATE' } = req.body
  if (!title) {
    res.status(400).json({ error: '标题不能为空' })
    return
  }

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    res.status(400).json({ error: '无效的权限设置' })
    return
  }

  const quizSet = await prisma.quizSet.create({
    data: { title, description, visibility, authorId: req.userId! },
    include: { author: { select: { id: true, username: true } } },
  })
  res.status(201).json(quizSet)
})

// ── POST /quiz/:id/items/tag-check ───────────────────────────
router.post('/:id/items/tag-check', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!

  const access = await canEdit(quizSetId, userId)
  if (access === null) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (access === false) {
    res.status(403).json({ error: '无编辑权限' })
    return
  }

  const tags = toStringArray(req.body?.tags)
  const { existingTagIds, missingNames } = await resolveTagDecision(tags, quizSetId)
  res.json({ existingTagIds, missingNames })
})

// ── GET /quiz/:id — 题库详情 ──────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!

  const access = await canRead(quizSetId, userId)
  if (access === null) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (access === false) {
    res.status(403).json({ error: '无权访问' })
    return
  }

  const quizSet = await prisma.quizSet.findUnique({
    where: { id: quizSetId },
    include: {
      author: { select: { id: true, username: true } },
      quizzes: {
        include: {
          tags: { include: { tag: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  res.json(quizSet)
})

// ── DELETE /quiz/batch ───────────────────────────────────────
router.delete('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const ids = toNumberArray(req.body?.ids)

  if (ids.length === 0) {
    res.status(400).json({ error: 'ids 不能为空' })
    return
  }

  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: ids } },
    include: { quizSet: true },
  })

  for (const quiz of quizzes) {
    const ok = quiz.quizSet.authorId === userId || quiz.quizSet.visibility === 'PUBLIC_EDIT'
    if (!ok) {
      res.status(403).json({ error: '无权删除部分题目' })
      return
    }
  }

  await prisma.quiz.deleteMany({ where: { id: { in: ids } } })
  res.json({ deleted: ids.length })
})

// ── DELETE /quiz/item/:id ────────────────────────────────────
router.delete('/item/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizId = parseInt(String(req.params.id))
  const userId = req.userId!

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, quizSetId: true },
  })

  if (!quiz) {
    res.status(404).json({ error: '题目不存在' })
    return
  }

  const access = await canEdit(quiz.quizSetId, userId)
  if (access === false) {
    res.status(403).json({ error: '无编辑权限' })
    return
  }

  await prisma.quiz.delete({ where: { id: quizId } })
  res.json({ ok: true })
})

// ── DELETE /quiz/:id ─────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (qs.authorId !== userId) {
    res.status(403).json({ error: '只有作者可以删除题库' })
    return
  }

  await prisma.quizSet.delete({ where: { id: quizSetId } })
  res.json({ message: '删除成功' })
})

// ── PATCH /quiz/:id/visibility ───────────────────────────────
router.patch('/:id/visibility', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!
  const { visibility } = req.body

  const validVisibility = ['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT']
  if (!validVisibility.includes(visibility)) {
    res.status(400).json({ error: '无效的权限设置' })
    return
  }

  const qs = await prisma.quizSet.findUnique({ where: { id: quizSetId } })
  if (!qs) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (qs.authorId !== userId) {
    res.status(403).json({ error: '只有作者可以修改权限' })
    return
  }

  const updated = await prisma.quizSet.update({
    where: { id: quizSetId },
    data: { visibility },
  })

  res.json(updated)
})

// ── POST /quiz/:id/items — 添加题目（答案可空）────────────────
router.post('/:id/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!

  const access = await canEdit(quizSetId, userId)
  if (access === null) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (access === false) {
    res.status(403).json({ error: '无编辑权限' })
    return
  }

  const question = String(req.body?.question ?? '').trim()
  const answer = String(req.body?.answer ?? '').trim()
  const note = normalizeNote(req.body?.note)
  const difficulty = parseDifficulty(req.body?.difficulty)

  if (!question) {
    res.status(400).json({ error: '题目不能为空' })
    return
  }

  const reqTagIds = toNumberArray(req.body?.tagIds)
  const reqTags = toStringArray(req.body?.tags)

  let tagIds: number[] = []

  if (reqTagIds.length > 0) {
    tagIds = reqTagIds
  } else if (reqTags.length > 0) {
    const { existingTagIds, missingNames } = await resolveTagDecision(reqTags, quizSetId)
    if (missingNames.length > 0) {
      res.status(400).json({ error: '存在未创建标签，请先确认创建', missingNames })
      return
    }
    tagIds = existingTagIds
  }

  const quiz = await prisma.quiz.create({
    data: {
      question,
      answer, // 可为空字符串
      note,
      quizSetId,
      difficulty,
      tags: { create: tagIds.map(tagId => ({ tagId })) },
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
  if (!quiz) {
    res.status(404).json({ error: '题目不存在' })
    return
  }

  const access = await canEdit(quiz.quizSetId, userId)
  if (access === false) {
    res.status(403).json({ error: '无编辑权限' })
    return
  }

  const question = String(req.body?.question ?? quiz.question).trim()
  const answer = String(req.body?.answer ?? '').trim()
  const note = normalizeNote(req.body?.note)
  const difficulty = parseDifficulty(req.body?.difficulty)

  const reqTagIds = toNumberArray(req.body?.tagIds)
  const reqTags = toStringArray(req.body?.tags)

  let tagIds: number[] = []

  if (reqTagIds.length > 0) {
    tagIds = reqTagIds
  } else if (reqTags.length > 0) {
    const { existingTagIds, missingNames } = await resolveTagDecision(reqTags, quiz.quizSetId)
    if (missingNames.length > 0) {
      res.status(400).json({ error: '存在未创建标签，请先确认创建', missingNames })
      return
    }
    tagIds = existingTagIds
  }

  await prisma.quizTag.deleteMany({ where: { quizId } })

  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      question,
      answer,
      note,
      difficulty,
      tags: { create: tagIds.map(tagId => ({ tagId })) },
    },
    include: {
      tags: { include: { tag: true }, orderBy: { order: 'asc' } },
    },
  })

  res.json(updated)
})

// ── PATCH /quiz/:id/items/reorder ────────────────────────────
router.patch('/:id/items/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  const quizSetId = parseInt(String(req.params.id))
  const userId = req.userId!

  const access = await canEdit(quizSetId, userId)
  if (access === null) {
    res.status(404).json({ error: '题库不存在' })
    return
  }
  if (access === false) {
    res.status(403).json({ error: '无编辑权限' })
    return
  }

  const ordersRaw = req.body?.orders
  if (!Array.isArray(ordersRaw)) {
    res.status(400).json({ error: 'orders 格式错误' })
    return
  }

  const orders: { id: number; order: number }[] = ordersRaw
    .map((x: any) => ({ id: Number(x?.id), order: Number(x?.order) }))
    .filter(x => Number.isInteger(x.id) && Number.isInteger(x.order))

  await Promise.all(
    orders.map(({ id, order }) =>
      prisma.quiz.update({ where: { id }, data: { order } })
    )
  )

  res.json({ updated: orders.length })
})

export default router
