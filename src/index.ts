import dns from "node:dns"
dns.setServers(["8.8.8.8", "1.1.1.1"])

import "dotenv/config"
import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import authRouter from "./routes/auth.routes"
import topicRouter from "./routes/topic.routes"
import explanationRouter from "./routes/explanation.routes"
import quizRouter from "./routes/quiz.routes"

const PORT = process.env.PORT || 5000
const MONGO_URL = process.env.MONGO_URL || ""

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/v1/health", (_req, res) => {
  res.json({ message: "SimplyTutor API is running" })
})

app.use("/api/v1/auth", authRouter)
app.use("/api/v1/topics", topicRouter)
app.use("/api/v1/explanations", explanationRouter)
app.use("/api/v1/quizzes", quizRouter)

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("DB connected..!")
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => console.error("DB connection failed..!", err))