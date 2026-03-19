import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT' | 'YEAR'

// ── 按名字解析/创建 tag，返回 id 列表 ────────────────────────
// KNOWLEDGE / SOURCE 必须已存在；其余兜底用 CONTEXT 创建
export async function resolveTagIds(tagNames: string[]): Promise<number[]> {
  const tags = await Promise.all(
    tagNames.map(async name => {
      const existing = await prisma.tag.findUnique({ where: { name } })
      if (existing) return existing
      return prisma.tag.create({ data: { name, dimension: 'CONTEXT' } })
    })
  )
  return tags.map(t => t.id)
}

// ── 递归构建树形结构 ──────────────────────────────────────────
export interface TagNode {
  id: number
  name: string
  dimension: string
  parentId: number | null
  aliases: string[]
  children: TagNode[]
  quizCount: number
}

export async function buildTagTree(dimension?: string): Promise<TagNode[]> {
  const where = dimension ? { dimension, parentId: null } : { parentId: null }

  const roots = await prisma.tag.findMany({
    where,
    include: {
      children: {
        include: {
          children: {            // 支持三层：根 → 一级 → 二级
            include: {
              _count: { select: { quizzes: true } }
            }
          },
          _count: { select: { quizzes: true } }
        }
      },
      _count: { select: { quizzes: true } }
    },
    orderBy: { name: 'asc' }
  })

  function mapNode(node: any): TagNode {
    return {
      id: node.id,
      name: node.name,
      dimension: node.dimension,
      parentId: node.parentId,
      aliases: safeParseAliases(node.aliases),
      quizCount: node._count.quizzes,
      children: (node.children ?? []).map(mapNode),
    }
  }

  return roots.map(mapNode)
}

// ── 安全解析 aliases JSON 字符串 ─────────────────────────────
export function safeParseAliases(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}
