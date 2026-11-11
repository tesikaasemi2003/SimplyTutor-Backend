import { Router } from "express"
import {
  getMyExplanations,
  submitExplanation
} from "../controllers/explanation.controller"
import { authenticate } from "../middlewares/auth"

const router = Router()

router.post("/", authenticate, submitExplanation)
router.get("/me", authenticate, getMyExplanations)

export default router