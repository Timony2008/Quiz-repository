import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, password: hashedPassword }
    })
    res.json({ message: '注册成功', userId: user.id })
  } catch (error) {
    res.status(500).json({ error: '注册失败' })
  }
})

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return res.status(401).json({ error: '用户不存在' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: '密码错误' })

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    )
    // ✅ 修复：加上 userId 返回
    res.json({ token, userId: user.id })
  } catch (error) {
    res.status(500).json({ error: '登录失败' })
  }
})

export default router
