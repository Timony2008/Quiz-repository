import { Router } from 'express'
import authRoutes from './auth'
import quizRoutes from './quiz'
import uploadRoutes from './upload'

const router = Router()

router.use('/auth', authRoutes)
router.use('/quizzes', quizRoutes)
router.use('/upload', uploadRoutes)

export default router
