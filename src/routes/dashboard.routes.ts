import { Router } from "express"
import { getMyDashboard } from "../controllers/dashboard.controller"
import { authenticate } from "../middlewares/auth"

const router = Router()

router.get("/me", authenticate, getMyDashboard)

export default router