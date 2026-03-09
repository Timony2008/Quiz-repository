import { Router } from 'express'
import authRouter from './auth'
import quizRouter from './quiz'
import uploadRouter from './upload'
import tagRouter from './tag'          // ← 新增

const router = Router()

router.use('/auth', authRouter)
router.use('/quiz', quizRouter)
router.use('/upload', uploadRouter)
router.use('/tag', tagRouter)          // ← 新增

export default router
