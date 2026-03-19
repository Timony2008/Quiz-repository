import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── 树节点类型 ────────────────────────────────────────────────
export interface TagNode {
  id:         number
  name:       string
  isGlobal:   boolean
  parentId:   number | null
  quizSetId:  number | null
  children:   TagNode[]
  quizCount:  number
}

// ── 递归构建全局标签树 ────────────────────────────────────────
export async function buildTagTree(): Promise<TagNode[]> {
  const all = await prisma.tag.findMany({
    where:   { isGlobal: true },
    include: { _count: { select: { quizzes: true } } },
    orderBy: { name: 'asc' },
  })

  const map = new Map<number, TagNode>()
  for (const t of all) {
    map.set(t.id, {
      id:        t.id,
      name:      t.name,
      isGlobal:  t.isGlobal,
      parentId:  t.parentId,
      quizSetId: t.quizSetId,
      children:  [],
      quizCount: t._count.quizzes,
    })
  }

  const roots: TagNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ── 按名字解析标签 id（全局优先，找不到则在题库内创建私有标签）
export async function resolveTagIds(
  tagNames: string[],
  quizSetId: number
): Promise<number[]> {
  const ids = await Promise.all(
    tagNames.map(async name => {
      // 1. 先找全局标签
      const global = await prisma.tag.findFirst({
        where: { name, isGlobal: true }
      })
      if (global) return global.id

      // 2. 再找该题库的私有标签
      const existing = await prisma.tag.findFirst({
        where: { name, quizSetId, isGlobal: false }
      })
      if (existing) return existing.id

      // 3. 都没有 → 创建私有标签
      const created = await prisma.tag.create({
        data: { name, isGlobal: false, quizSetId }
      })
      return created.id
    })
  )
  return ids
}

// ── 递归收集某标签及其所有子孙的 id ──────────────────────────
export async function collectDescendantIds(tagId: number): Promise<number[]> {
  const children = await prisma.tag.findMany({
    where:  { parentId: tagId },
    select: { id: true },
  })
  const childIds = await Promise.all(children.map(c => collectDescendantIds(c.id)))
  return [tagId, ...childIds.flat()]
}
