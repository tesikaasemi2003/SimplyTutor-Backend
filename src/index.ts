import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import mongoose from "mongoose"
import { rateLimit } from "express-rate-limit"
import authRouter from "./routes/auth.routes"
import topicRouter from "./routes/topic.routes"
import explanationRouter from "./routes/explanation.routes"
import quizRouter from "./routes/quiz.routes"
import dashboardRouter from "./routes/dashboard.routes"

const PORT = process.env.PORT || 5000
const MONGO_URL = process.env.MONGO_URL || ""
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())

// serverless friendly: connect once per instance and reuse the connection
let connection: Promise<typeof mongoose> | null = null

const connectDB = () => {
  if (!connection) {
    connection = mongoose
      .connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 })
      .catch((err) => {
        connection = null // let the next request try again
        throw err
      })
  }
  return connection
}

const app = express()

// the platform sits behind a proxy: needed so rate limiting sees the real IP
app.set("trust proxy", 1)

app.use(helmet())
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: "20kb" }))

// these two answer without touching the database
app.get("/", (_req, res) => {
  res.json({ message: "SimplyTutor API" })
})

app.get("/api/v1/health", (_req, res) => {
  res.json({ message: "SimplyTutor API is running" })
})

// every other request makes sure the database is connected first
app.use(async (_req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (err) {
    console.error("DB connection failed..!", err)
    res.status(503).json({ message: "Database unavailable, try again..!" })
  }
})

// stops password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts, try again in a few minutes..!" }
})

// stops one person from burning the Gemini quota
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Hourly limit reached for AI features, try again later..!" }
})

app.use("/api/v1/auth", authLimiter, authRouter)
app.use("/api/v1/topics", topicRouter)
app.use("/api/v1/explanations", aiLimiter, explanationRouter)
app.use("/api/v1/quizzes", aiLimiter, quizRouter)
app.use("/api/v1/dashboard", dashboardRouter)

// on your laptop: start a normal server. On Vercel the platform runs `app` itself
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      console.log("DB connected..!")
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`)
      })
    })
    .catch((err) => console.error("DB connection failed..!", err))
}

export default app