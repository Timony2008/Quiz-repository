import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {

  // ── 辅助函数：查无则建，全局标签专用 ──────────────────────────
  async function upsertGlobal(name: string, parentId?: number) {
    const existing = await prisma.tag.findFirst({
      where: { name, isGlobal: true }
    })
    if (existing) return existing

    return prisma.tag.create({
      data: {
        name,
        isGlobal: true,
        parentId: parentId ?? null,
        quizSetId: null,
      }
    })
  }

  // ── 一级标签 ──────────────────────────────────────────────────
  const algebra       = await upsertGlobal('代数')
  const numberTheory  = await upsertGlobal('数论')
  const geometry      = await upsertGlobal('几何')
  const combinatorics = await upsertGlobal('组合')

  // ── 代数子标签 ────────────────────────────────────────────────
  for (const name of ['多项式', '不等式', '函数方程', '数列', '换元法', '配方法']) {
    await upsertGlobal(name, algebra.id)
  }

  // ── 数论子标签 ────────────────────────────────────────────────
  for (const name of ['整除与同余', '素数', '数论函数', '丢番图方程']) {
    await upsertGlobal(name, numberTheory.id)
  }

  // ── 几何子标签 ────────────────────────────────────────────────
  for (const name of ['平面几何', '圆与圆幂', '三角形', '射影几何', '解析几何']) {
    await upsertGlobal(name, geometry.id)
  }

  // ── 组合子标签 ────────────────────────────────────────────────
  for (const name of ['计数', '图论', '极值组合', '鸽巢原理', '构造法']) {
    await upsertGlobal(name, combinatorics.id)
  }

  // ── 通用方法（无父标签） ──────────────────────────────────────
  for (const name of ['数学归纳法', '反证法', '极端原理']) {
    await upsertGlobal(name)
  }

  // ── 来源标签 ─────────────────────────────────────────────────
  for (const name of ['IMO', 'CMO', 'USAMO', 'AIME', 'AMC', 'CGMO', '联赛', '模拟题']) {
    await upsertGlobal(name)
  }

  console.log('✅ 全局标签预置完成')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
