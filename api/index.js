// api/index.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import emailRoutes from './routes/email.js'
import authRoutes from './routes/auth.js'
import notificationRoutes from './routes/notifications.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
  })
)

app.use(express.json())

// Routes
app.use('/api/email', emailRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/notifications', notificationRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Rotapp API running on port ${PORT}`)
})
