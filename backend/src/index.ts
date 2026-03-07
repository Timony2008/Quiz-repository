import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import { authMiddleware } from './middleware/auth'
import router from './routes/index'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// ✅ 登录/注册不需要鉴权，单独提前挂
app.use('/api/auth', authRoutes)

// ✅ 其余所有路由都经过 authMiddleware
app.use('/api', authMiddleware, router)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})

export default app
