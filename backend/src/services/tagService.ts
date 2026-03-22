import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

function normalizeDimension(v: any): TagDimension {
  return v === 'KNOWLEDGE' || v === 'METHOD' || v === 'SOURCE' || v === 'CONTEXT'
    ? v
    : 'CONTEXT'
}

// ── 树节点类型 ────────────────────────────────────────────────
export interface TagNode {
  id: number
  name: string
  dimension: TagDimension
  isGlobal: boolean
  parentId: number | null
  quizSetId: number | null
  children: TagNode[]
  quizCount: number
}

// ── 递归构建全局标签树 ────────────────────────────────────────
export async function buildTagTree(): Promise<TagNode[]> {
  const all = await prisma.tag.findMany({
    where: { isGlobal: true },
    include: { _count: { select: { quizzes: true } } },
    orderBy: { name: 'asc' },
  })

  const map = new Map<number, TagNode>()
  for (const t of all) {
    map.set(t.id, {
      id: t.id,
      name: t.name,
      dimension: normalizeDimension((t as any).dimension),
      isGlobal: t.isGlobal,
      parentId: t.parentId,
      quizSetId: t.quizSetId,
      children: [],
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

// ── 工具：去重 + 清洗标签名 ───────────────────────────────────
function normalizeTagNames(tagNames: string[]): string[] {
  return [...new Set(
    (tagNames || [])
      .map(n => String(n).trim())
      .filter(Boolean)
  )]
}

// ── 解析结果：已有标签 + 缺失标签（不会创建）────────────────────
export async function resolveTagDecision(
  tagNames: string[],
  quizSetId: number
): Promise<{ existingTagIds: number[]; missingNames: string[] }> {
  const names = normalizeTagNames(tagNames)
  if (names.length === 0) {
    return { existingTagIds: [], missingNames: [] }
  }

  const existing = await prisma.tag.findMany({
    where: {
      name: { in: names },
      OR: [
        { isGlobal: true },
        { isGlobal: false, quizSetId },
      ],
    },
    select: { id: true, name: true, isGlobal: true },
  })

  // 全局优先：同名时优先取全局标签 id
  const bestByName = new Map<string, { id: number; isGlobal: boolean }>()
  for (const t of existing) {
    const prev = bestByName.get(t.name)
    if (!prev || (!prev.isGlobal && t.isGlobal)) {
      bestByName.set(t.name, { id: t.id, isGlobal: t.isGlobal })
    }
  }

  const existingTagIds: number[] = []
  const missingNames: string[] = []

  for (const name of names) {
    const hit = bestByName.get(name)
    if (hit) existingTagIds.push(hit.id)
    else missingNames.push(name)
  }

  return { existingTagIds, missingNames }
}

// ── 兼容旧调用：仅返回已有标签 id（不创建新标签）───────────────
export async function resolveTagIds(
  tagNames: string[],
  quizSetId: number
): Promise<number[]> {
  const { existingTagIds } = await resolveTagDecision(tagNames, quizSetId)
  return existingTagIds
}

// ── 递归收集某标签及其所有子孙的 id ──────────────────────────
export async function collectDescendantIds(tagId: number): Promise<number[]> {
  const children = await prisma.tag.findMany({
    where: { parentId: tagId },
    select: { id: true },
  })
  const childIds = await Promise.all(children.map(c => collectDescendantIds(c.id)))
  return [tagId, ...childIds.flat()]
}
