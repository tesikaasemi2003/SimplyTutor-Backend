import { Router } from "express"
import { rateLimit } from "express-rate-limit"
import {
  approveTopic,
  cancelPublishRequest,
  createTopic,
  deleteTopic,
  getTopicById,
  getTopics,
  listPublishRequests,
  rejectTopic,
  requestPublish,
  updateTopic
} from "../controllers/topic.controller"
import { authenticate, authorize } from "../middlewares/auth"

const router = Router()

// stops one learner from spamming topics / publish requests
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many topic changes, try again later..!" }
})

// any logged-in user (private topics are filtered by the controller)
router.get("/", authenticate, getTopics)

// ADMIN review queue (must come before "/:id")
router.get(
  "/publish-requests",
  authenticate,
  authorize("ADMIN"),
  listPublishRequests
)

router.get("/:id", authenticate, getTopicById)

// admins create public topics, learners create private ones
router.post("/", authenticate, writeLimiter, createTopic)

// owner (or admin), the controller checks which
router.put("/:id", authenticate, writeLimiter, updateTopic)
router.delete("/:id", authenticate, deleteTopic)

// learner: "Suggest to everyone"
router.post("/:id/publish-request", authenticate, writeLimiter, requestPublish)
router.delete("/:id/publish-request", authenticate, cancelPublishRequest)

// ADMIN: approve / reject a publish request
router.post("/:id/approve", authenticate, authorize("ADMIN"), approveTopic)
router.post("/:id/reject", authenticate, authorize("ADMIN"), rejectTopic)

export default router