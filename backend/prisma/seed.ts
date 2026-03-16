import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // ── KNOWLEDGE 一级节点 ────────────────────────────────────────
  const algebra = await prisma.tag.upsert({
    where: { name: '代数' },
    update: {},
    create: { name: '代数', dimension: 'KNOWLEDGE' }
  })
  const numberTheory = await prisma.tag.upsert({
    where: { name: '数论' },
    update: {},
    create: { name: '数论', dimension: 'KNOWLEDGE' }
  })
  const geometry = await prisma.tag.upsert({
    where: { name: '几何' },
    update: {},
    create: { name: '几何', dimension: 'KNOWLEDGE' }
  })
  const combinatorics = await prisma.tag.upsert({
    where: { name: '组合' },
    update: {},
    create: { name: '组合', dimension: 'KNOWLEDGE' }
  })

  // ── KNOWLEDGE 二级节点 ────────────────────────────────────────
  const knowledgeChildren: { name: string; parentId: number }[] = [
    // 代数
    { name: '多项式',     parentId: algebra.id },
    { name: '数列与极限', parentId: algebra.id },
    { name: '不等式',     parentId: algebra.id },
    { name: '函数与方程', parentId: algebra.id },
    // 数论
    { name: '整除与同余', parentId: numberTheory.id },
    { name: '素数',       parentId: numberTheory.id },
    { name: '数论函数',   parentId: numberTheory.id },
    // 几何
    { name: '平面几何',   parentId: geometry.id },
    { name: '解析几何',   parentId: geometry.id },
    { name: '空间几何',   parentId: geometry.id },
    // 组合
    { name: '计数原理',   parentId: combinatorics.id },
    { name: '图论',       parentId: combinatorics.id },
    { name: '组合恒等式', parentId: combinatorics.id },
  ]

  for (const child of knowledgeChildren) {
    await prisma.tag.upsert({
      where: { name: child.name },
      update: {},
      create: { name: child.name, dimension: 'KNOWLEDGE', parentId: child.parentId }
    })
  }

  // ── METHOD 思想方法 ───────────────────────────────────────────
  const methods = ['构造法', '数学归纳法', '反证法', '极端原理', '鸽巢原理', '换元法', '配方法']
  for (const name of methods) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, dimension: 'METHOD' }
    })
  }

  // ── SOURCE 出处 ───────────────────────────────────────────────
  const sources = ['IMO', 'CMO', 'USAMO', 'AIME', 'AMC', '联赛', '模拟题']
  for (const name of sources) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, dimension: 'SOURCE' }
    })
  }

  // ── CONTEXT 教学场景 ──────────────────────────────────────────
  const contexts = ['易错题', '压轴', '经典题', '竞赛入门']
  for (const name of contexts) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, dimension: 'CONTEXT' }
    })
  }

  console.log('✅ 标签字典初始化完成')
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
