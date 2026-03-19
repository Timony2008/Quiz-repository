// auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?:   { id: number; username: string }
  userId?: number   // ← 新增快捷字段
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: '未登录' })

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as { id: number; username: string }

    req.user   = decoded
    req.userId = decoded.id   // ← 同步写入
    next()
  } catch {
    res.status(401).json({ error: 'token无效' })
  }
}
