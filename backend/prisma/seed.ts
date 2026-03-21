import { PrismaClient } from '@prisma/client'
type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

const prisma = new PrismaClient()

async function main() {
  // 全局标签 upsert（按 name + isGlobal）
  async function upsertGlobal(
    name: string,
    dimension: TagDimension,
    parentId?: number
  ) {
    const existing = await prisma.tag.findFirst({
      where: { name, isGlobal: true }
    })
    if (existing) {
      // 保证已有数据也能被“纠正维度”
      return prisma.tag.update({
        where: { id: existing.id },
        data: {
          dimension,
          parentId: parentId ?? existing.parentId ?? null,
          quizSetId: null,
          isGlobal: true,
        }
      })
    }

    return prisma.tag.create({
      data: {
        name,
        dimension,
        isGlobal: true,
        parentId: parentId ?? null,
        quizSetId: null,
      }
    })
  }

  // ── 模块根（KNOWLEDGE）──────────────────────────────────────
  const algebra       = await upsertGlobal('代数', 'KNOWLEDGE')
  const numberTheory  = await upsertGlobal('数论', 'KNOWLEDGE')
  const geometry      = await upsertGlobal('几何', 'KNOWLEDGE')
  const combinatorics = await upsertGlobal('组合', 'KNOWLEDGE')

  // ── KNOWLEDGE 子标签（纯知识点）─────────────────────────────
  for (const name of ['多项式', '不等式', '函数方程', '数列']) {
    await upsertGlobal(name, 'KNOWLEDGE', algebra.id)
  }

  for (const name of ['整除与同余', '素数', '数论函数', '丢番图方程']) {
    await upsertGlobal(name, 'KNOWLEDGE', numberTheory.id)
  }

  for (const name of ['平面几何', '圆与圆幂', '三角形', '射影几何', '解析几何']) {
    await upsertGlobal(name, 'KNOWLEDGE', geometry.id)
  }

  for (const name of ['计数', '图论', '极值组合', '鸽巢原理']) {
    await upsertGlobal(name, 'KNOWLEDGE', combinatorics.id)
  }

  // ── METHOD（思想方法）──────────────────────────────────────
  for (const name of ['数学归纳法', '反证法', '极端原理', '构造法', '换元法', '配方法']) {
    await upsertGlobal(name, 'METHOD')
  }

  // ── SOURCE（来源）──────────────────────────────────────────
  for (const name of ['IMO', 'CMO', 'USAMO', 'AIME', 'AMC', 'CGMO', '联赛', '模拟题']) {
    await upsertGlobal(name, 'SOURCE')
  }

  console.log('✅ 全局标签预置完成（含 dimension）')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
