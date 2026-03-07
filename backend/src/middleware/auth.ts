import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: number
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: '未登录' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number }
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ error: 'Token 无效' })
  }
}
