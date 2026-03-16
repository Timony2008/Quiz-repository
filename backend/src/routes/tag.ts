import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

const router = Router()
const prisma = new PrismaClient()


// ── GET /api/tag — 获取标签列表 ───────────────────────────────
// ?dimension=KNOWLEDGE 返回树形结构
// ?dimension=METHOD 等返回平铺列表
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { dimension } = req.query

  // 校验 dimension 参数
  const validDimensions = ['KNOWLEDGE', 'METHOD', 'SOURCE', 'CONTEXT']
  if (dimension && !validDimensions.includes(String(dimension))) {
    return res.status(400).json({ error: `无效的 dimension，可选值：${validDimensions.join(', ')}` })
  }

  const where = dimension ? { dimension: String(dimension) as TagDimension } : {}

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { id: 'asc' }
  })

  // KNOWLEDGE 维度返回树形结构
  if (dimension === 'KNOWLEDGE') {
    const roots = tags.filter(t => t.parentId === null)
    const children = tags.filter(t => t.parentId !== null)

    const tree = roots.map(root => ({
      ...root,
      children: children.filter(c => c.parentId === root.id)
    }))

    return res.json(tree)
  }

  res.json(tags)
})

// ── POST /api/tag — 创建标签 ──────────────────────────────────
// 必须传 dimension；KNOWLEDGE / SOURCE 不允许前端随意创建
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, dimension, parentId, aliases } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '标签名不能为空' })
  }

  const validDimensions = ['KNOWLEDGE', 'METHOD', 'SOURCE', 'CONTEXT']
  if (!dimension || !validDimensions.includes(dimension)) {
    return res.status(400).json({ error: `必须指定 dimension，可选值：${validDimensions.join(', ')}` })
  }

  // KNOWLEDGE / SOURCE 维度受保护，不允许前端随意创建
  const protectedDimensions = ['KNOWLEDGE', 'SOURCE']
  if (protectedDimensions.includes(dimension)) {
    return res.status(403).json({ error: `${dimension} 维度的标签只能由管理员通过 seed 维护` })
  }

  // 检查重名
  const existing = await prisma.tag.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return res.status(409).json({ error: '标签名已存在', tag: existing })
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      dimension: dimension as TagDimension,
      parentId: parentId ?? null,
      aliases: aliases ?? null
    }
  })

  res.status(201).json(tag)
})

// ── PATCH /api/tag/:id — 更新标签 ────────────────────────────
// 支持重命名 / 修改 parentId / 更新 aliases
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId = parseInt(String(req.params.id))
  const { name, parentId, aliases } = req.body

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag) return res.status(404).json({ error: '标签不存在' })

  // 重名检查（排除自身）
  if (name && name.trim() !== tag.name) {
    const conflict = await prisma.tag.findUnique({ where: { name: name.trim() } })
    if (conflict) {
      return res.status(409).json({ error: '标签名已存在', tag: conflict })
    }
  }

  // parentId 不能指向自身
  if (parentId !== undefined && parentId === tagId) {
    return res.status(400).json({ error: 'parentId 不能指向自身' })
  }

  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(parentId !== undefined && { parentId: parentId === null ? null : Number(parentId) }),
      ...(aliases !== undefined && { aliases })
    }
  })

  res.json(updated)
})

// ── POST /api/tag/merge — 合并标签 ───────────────────────────
// 将标签 A 的所有 QuizTag 迁移到标签 B，然后删除 A
router.post('/merge', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sourceId, targetId } = req.body

  if (!sourceId || !targetId) {
    return res.status(400).json({ error: '需要提供 sourceId 和 targetId' })
  }
  if (sourceId === targetId) {
    return res.status(400).json({ error: 'sourceId 和 targetId 不能相同' })
  }

  const [source, target] = await Promise.all([
    prisma.tag.findUnique({ where: { id: sourceId } }),
    prisma.tag.findUnique({ where: { id: targetId } })
  ])

  if (!source) return res.status(404).json({ error: `标签 ${sourceId} 不存在` })
  if (!target) return res.status(404).json({ error: `标签 ${targetId} 不存在` })

  // 找出 source 下所有 QuizTag
  const sourceQuizTags = await prisma.quizTag.findMany({ where: { tagId: sourceId } })

  // 找出 target 下已有的 quizId，避免重复插入
  const targetQuizIds = new Set(
    (await prisma.quizTag.findMany({ where: { tagId: targetId } })).map(qt => qt.quizId)
  )

  // 需要迁移的（target 尚未有的）
  const toMigrate = sourceQuizTags.filter(qt => !targetQuizIds.has(qt.quizId))

  await prisma.$transaction([
    // 插入迁移记录
    prisma.quizTag.createMany({
      data: toMigrate.map(qt => ({ quizId: qt.quizId, tagId: targetId }))
    }),
    // 删除 source 的所有 QuizTag
    prisma.quizTag.deleteMany({ where: { tagId: sourceId } }),
    // 删除 source 标签本身
    prisma.tag.delete({ where: { id: sourceId } })
  ])

  res.json({
    message: `标签「${source.name}」已合并到「${target.name}」`,
    migratedCount: toMigrate.length
  })
})

// ── DELETE /api/tag/:id — 删除标签 ───────────────────────────
// 删除前检查是否有题目关联，有则返回警告
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tagId = parseInt(String(req.params.id))
  const { force } = req.query  // ?force=true 强制删除

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag) return res.status(404).json({ error: '标签不存在' })

  const quizCount = await prisma.quizTag.count({ where: { tagId } })

  if (quizCount > 0 && force !== 'true') {
    return res.status(409).json({
      error: `该标签关联了 ${quizCount} 道题目，删除将移除所有关联`,
      quizCount,
      hint: '如确认删除，请携带 ?force=true 重新请求'
    })
  }

  await prisma.quizTag.deleteMany({ where: { tagId } })
  await prisma.tag.delete({ where: { id: tagId } })

  res.json({ message: '标签已删除', quizCount })
})

export default router
