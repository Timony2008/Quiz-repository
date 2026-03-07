import { Router } from 'express'
import authRouter from './auth'
import quizRouter from './quiz'
import uploadRouter from './upload'

const router = Router()

router.use('/auth', authRouter)
router.use('/quiz', quizRouter)
router.use('/upload', uploadRouter)

export default router
