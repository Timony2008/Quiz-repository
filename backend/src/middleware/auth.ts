// auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { id: number; username: string }
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: '未登录' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: number; username: string }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'token无效' })
  }
}
