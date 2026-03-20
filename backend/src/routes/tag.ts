import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { buildTagTree, resolveTagIds, collectDescendantIds } from '../services/tagService'

const router = Router()
const prisma = new PrismaClient()

// ── GET /api/tag ─ 平铺列表 ──────────────────────────────────
// ?scope=global          只返回全局标签
// ?scope=private&quizSetId=3  只返回某题库私有标签
// 不传 scope             返回全部
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { scope, quizSetId } = req.query

  const where =
    scope === 'global'  ? { isGlobal: true } :
    scope === 'private' ? { isGlobal: false, quizSetId: Number(quizSetId) } :
    {}

  const tags = await prisma.tag.findMany({
    where,
    include: {
      _count:   { select: { quizzes: true } },
      parent:   { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })

  res.json(tags.map(t => ({
    ...t,
    quizCount: t._count.quizzes,
    _count: undefined,
  })))
})

// ── GET /api/tag/tree ─ 全局标签树形 ─────────────────────────
router.get('/tree', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const tree = await buildTagTree()
  res.json(tree)
})

// ── GET /api/tag/search?q= ─ 搜索标签 ────────────────────────
// 全局标签 + 当前用户有权限的题库私有标签
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q         = String(req.query.q ?? '').trim()
  const quizSetId = req.query.quizSetId ? Number(req.query.quizSetId) : undefined

  if (!q) { res.json([]); return }

  const tags = await prisma.tag.findMany({
    where: {
      name: { contains: q },
      OR: [
        { isGlobal: true },
        ...(quizSetId ? [{ quizSetId }] : []),
      ],
    },
    include: {
      _count:    { select: { quizzes: true } },
      parent:    { select: { id: true, name: true } },
      children:  { select: { id: true, name: true } },  // ← 加上 children
    },
    orderBy: { name: 'asc' },
    take: 20,
  })

  // ── 命中父标签时，把它的子标签也拉进结果 ──────────────────
  const extraIds = new Set<number>()
  for (const t of tags) {
    for (const child of t.children) {
      if (!tags.find(x => x.id === child.id)) {
        extraIds.add(child.id)
      }
    }
  }

  let extras: typeof tags = []
  if (extraIds.size > 0) {
    extras = await prisma.tag.findMany({
      where:   { id: { in: [...extraIds] } },
      include: {
        _count:   { select: { quizzes: true } },
        parent:   { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    })
  }

  const all = [...tags, ...extras]
  res.json(all.map(t => ({
    ...t,
    quizCount: t._count.quizzes,
    _count: undefined,
  })))
})

// ── GET /api/tag/:id ─ 单个标签详情 ──────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id  = parseInt(String(req.params.id))
  const tag = await prisma.tag.findUnique({
    where:   { id },
    include: {
      parent:   { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count:   { select: { quizzes: true } },
    },
  })
  if (!tag) { res.status(404).json({ error: 'not found' }); return }
  res.json({ ...tag, quizCount: tag._count.quizzes, _count: undefined })
})

// ── GET /api/tag/:id/quizzes ─ 某标签下所有题（含子标签）─────
router.get('/:id/quizzes', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id     = parseInt(String(req.params.id))
  const tagIds = await collectDescendantIds(id)

  const quizzes = await prisma.quiz.findMany({
    where:   { tags: { some: { tagId: { in: tagIds } } } },
    include: {
      tags:    { include: { tag: true }, orderBy: { order: 'asc' } },
      quizSet: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(quizzes)
})

// ── POST /api/tag ─ 创建标签 ──────────────────────────────────
// isGlobal=true 仅管理员可用（后续加权限校验）
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, parentId, quizSetId, isGlobal = false } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return }

  try {
    const tag = await prisma.tag.create({
      data: {
        name:      name.trim(),
        isGlobal:  Boolean(isGlobal),
        parentId:  parentId  ?? null,
        quizSetId: quizSetId ?? null,
      },
    })
    res.status(201).json(tag)
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '该标签已存在' }); return
    }
    throw e
  }
})

// ── PATCH /api/tag/:id ─ 修改标签 ────────────────────────────
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))
  const { name, parentId } = req.body

  const tag = await prisma.tag.update({
    where: { id },
    data:  {
      ...(name     !== undefined && { name: name.trim() }),
      ...(parentId !== undefined && { parentId }),
    },
  })
  res.json(tag)
})

// ── POST /api/tag/:id/attach ─ 批量打标签 ────────────────────
router.post('/:id/attach', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId    = parseInt(String(req.params.id))
  const quizIds: number[] = req.body.quizIds ?? []

  if (!quizIds.length) { res.status(400).json({ error: 'quizIds required' }); return }

  // upsert 避免重复关联报错
  await prisma.$transaction(
    quizIds.map(quizId =>
      prisma.quizTag.upsert({
        where:  { quizId_tagId: { quizId, tagId } },
        update: {},
        create: { quizId, tagId },
      })
    )
  )

  res.status(204).send()
})

// ── DELETE /api/tag/:id ─ 删除标签 ───────────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))
  await prisma.tag.delete({ where: { id } })
  res.status(204).send()
})

export default router
