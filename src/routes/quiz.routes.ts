import { Router } from "express"
import {
  generateQuizForTopic,
  getMyAttempts,
  getQuiz,
  submitAttempt
} from "../controllers/quiz.controller"
import { authenticate } from "../middlewares/auth"

const router = Router()

router.post("/generate", authenticate, generateQuizForTopic)
router.get("/attempts/me", authenticate, getMyAttempts)
router.get("/:id", authenticate, getQuiz)
router.post("/:id/attempts", authenticate, submitAttempt)

export default router