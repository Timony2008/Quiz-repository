import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import {
  resolveTagIds, buildTagTree, safeParseAliases, TagDimension
} from '../services/tagService'

const router = Router()
const prisma = new PrismaClient()

const VALID_DIMENSIONS: TagDimension[] = ['KNOWLEDGE', 'METHOD', 'SOURCE', 'CONTEXT', 'YEAR']

// ── GET /api/tag — 平铺列表（可按 dimension 筛选）────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { dimension } = req.query
  if (dimension && !VALID_DIMENSIONS.includes(dimension as TagDimension)) {
    res.status(400).json({ error: 'invalid dimension' }); return
  }
  const tags = await prisma.tag.findMany({
    where: dimension ? { dimension: dimension as string } : undefined,
    include: {
      _count: { select: { quizzes: true } },
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' }
  })
  res.json(tags.map(t => ({
    ...t,
    aliases: safeParseAliases(t.aliases),
    quizCount: t._count.quizzes,
  })))
})

// ── GET /api/tag/tree — 完整树形（可按 dimension 筛选）───────
router.get('/tree', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { dimension } = req.query
  if (dimension && !VALID_DIMENSIONS.includes(dimension as TagDimension)) {
    res.status(400).json({ error: 'invalid dimension' }); return
  }
  const tree = await buildTagTree(dimension as string | undefined)
  res.json(tree)
})

// ── GET /api/tag/:id — 单个标签详情 ─────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))
  const tag = await prisma.tag.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { quizzes: true } }
    }
  })
  if (!tag) { res.status(404).json({ error: 'not found' }); return }
  res.json({ ...tag, aliases: safeParseAliases(tag.aliases), quizCount: tag._count.quizzes })
})

// ── GET /api/tag/:id/quizzes — 某标签下所有题（含子标签）────
router.get('/:id/quizzes', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))

  // 递归收集自身 + 所有子孙 tag id
  async function collectIds(tagId: number): Promise<number[]> {
    const children = await prisma.tag.findMany({
      where: { parentId: tagId }, select: { id: true }
    })
    const childIds = await Promise.all(children.map(c => collectIds(c.id)))
    return [tagId, ...childIds.flat()]
  }

  const tagIds = await collectIds(id)
  const quizzes = await prisma.quiz.findMany({
    where: { tags: { some: { tagId: { in: tagIds } } } },
    include: {
      tags: { include: { tag: true } },
      quizSet: { select: { id: true, title: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })
  res.json(quizzes)
})

// ── POST /api/tag — 创建标签 ─────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, dimension = 'CONTEXT', parentId, aliases = [] } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return }
  if (!VALID_DIMENSIONS.includes(dimension)) {
    res.status(400).json({ error: 'invalid dimension' }); return
  }

  // parentId 只允许 KNOWLEDGE 维度使用
  const resolvedParentId = dimension === 'KNOWLEDGE' && parentId ? parentId : null

  try {
    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        dimension,
        parentId: resolvedParentId,
        aliases: JSON.stringify(aliases),
      }
    })
    res.json({ ...tag, aliases })
  } catch (e: any) {
    if (e.code === 'P2002') { res.status(409).json({ error: 'tag already exists' }); return }
    throw e
  }
})

// ── PUT /api/tag/:id — 更新标签 ──────────────────────────────
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))
  const { name, dimension, parentId, aliases } = req.body

  if (dimension && !VALID_DIMENSIONS.includes(dimension)) {
    res.status(400).json({ error: 'invalid dimension' }); return
  }

  const data: any = {}
  if (name !== undefined)      data.name = name.trim()
  if (dimension !== undefined) data.dimension = dimension
  if (aliases !== undefined)   data.aliases = JSON.stringify(aliases)
  if (parentId !== undefined)  data.parentId = parentId   // null 表示移到顶层

  try {
    const tag = await prisma.tag.update({ where: { id }, data })
    res.json({ ...tag, aliases: safeParseAliases(tag.aliases) })
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'not found' }); return }
    if (e.code === 'P2002') { res.status(409).json({ error: 'name conflict' }); return }
    throw e
  }
})

// ── DELETE /api/tag/:id — 删除标签（不删题目）───────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id))
  await prisma.tag.updateMany({ where: { parentId: id }, data: { parentId: null } })
  await prisma.tag.delete({ where: { id } })
  res.json({ ok: true })
})

// ── POST /api/tag/:id/attach — 批量打标签 ───────────────────
router.post('/:id/attach', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId = parseInt(String(req.params.id))
  const { quizIds } = req.body
  if (!Array.isArray(quizIds) || quizIds.length === 0) {
    res.status(400).json({ error: 'quizIds required' }); return
  }
  await Promise.all(
    quizIds.map((quizId: number) =>
      prisma.quizTag.upsert({
        where:  { quizId_tagId: { quizId, tagId } },
        update: {},
        create: { quizId, tagId },
      })
    )
  )
  res.json({ ok: true, attached: quizIds.length })
})

// ── DELETE /api/tag/:tagId/detach/:quizId — 移除单题标签 ────
router.delete('/:tagId/detach/:quizId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId  = parseInt(String(req.params.tagId))
  const quizId = parseInt(String(req.params.quizId))
  await prisma.quizTag.deleteMany({ where: { tagId, quizId } })
  res.json({ ok: true })
})

export default router
