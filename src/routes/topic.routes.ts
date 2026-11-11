import { Router } from "express"
import {
  createTopic,
  deleteTopic,
  getTopicById,
  getTopics,
  updateTopic
} from "../controllers/topic.controller"
import { authenticate, authorize } from "../middlewares/auth"

const router = Router()

// any logged-in user
router.get("/", authenticate, getTopics)
router.get("/:id", authenticate, getTopicById)

// ADMIN only
router.post("/", authenticate, authorize("ADMIN"), createTopic)
router.put("/:id", authenticate, authorize("ADMIN"), updateTopic)
router.delete("/:id", authenticate, authorize("ADMIN"), deleteTopic)

export default router