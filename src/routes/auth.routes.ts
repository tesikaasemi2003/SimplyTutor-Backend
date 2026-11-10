import { Router } from "express"
import {
  getMyDetails,
  login,
  refreshAccessToken,
  register
} from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth"

const router = Router()

// public
router.post("/register", register)
router.post("/login", login)
router.post("/refresh", refreshAccessToken)

// protected
router.get("/me", authenticate, getMyDetails)

export default router