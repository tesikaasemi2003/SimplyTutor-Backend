import { Response } from "express"
import { isValidObjectId, QueryFilter } from "mongoose"
import { ITopic, TopicModel } from "../models/topic.model"
import { AuthRequest } from "../middlewares/auth"
import {
  LIMITS,
  canAccessTopic,
  escapeRegex,
  isOwner,
  isPrivate
} from "../utils/topicAccess"

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const
type Difficulty = (typeof DIFFICULTIES)[number]

const isAdminReq = (req: AuthRequest): boolean =>
  (req.user?.roles as string[] | undefined)?.includes("ADMIN") ?? false

// validates + trims the body. The text goes into AI prompts, so length limits matter.
const parseTopicInput = (
  body: Record<string, unknown>
):
  | {
      error: string
    }
  | {
      value: {
        title: string
        description: string
        category: string
        difficulty: Difficulty
      }
    } => {
  const { title, description, category, difficulty } = body ?? {}

  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof category !== "string" ||
    !title.trim() ||
    !description.trim() ||
    !category.trim()
  ) {
    return { error: "title, description and category are required..!" }
  }
  if (title.trim().length > LIMITS.title) {
    return { error: `Title must be ${LIMITS.title} characters or fewer..!` }
  }
  if (description.trim().length > LIMITS.description) {
    return {
      error: `Description must be ${LIMITS.description} characters or fewer..!`
    }
  }
  if (category.trim().length > LIMITS.category) {
    return { error: `Category must be ${LIMITS.category} characters or fewer..!` }
  }

  const level: Difficulty = DIFFICULTIES.includes(difficulty as Difficulty)
    ? (difficulty as Difficulty)
    : "BEGINNER"

  return {
    value: {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      difficulty: level
    }
  }
}

// same title (ignoring case) among the topics this user can see: public + their own
const titleTaken = async (title: string, userId?: string, excludeId?: string) =>
  TopicModel.exists({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    title: new RegExp(`^${escapeRegex(title)}$`, "i"),
    $or: [{ visibility: { $ne: "PRIVATE" } }, { createdBy: userId }]
  })

// loads a topic the caller is allowed to see (private topics of others look like 404)
const loadVisibleTopic = async (
  req: AuthRequest,
  res: Response
): Promise<ITopic | null> => {
  const id = req.params.id as string
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid topic id..!" })
    return null
  }
  const topic = await TopicModel.findById(id)
  if (!topic || !canAccessTopic(topic, req.user?.sub)) {
    res.status(404).json({ message: "Topic not found..!" })
    return null
  }
  return topic
}

export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.sub
    const admin = isAdminReq(req)

    const parsed = parseTopicInput(req.body)
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error })
    }

    if (!admin) {
      const mine = await TopicModel.countDocuments({
        createdBy: userId,
        visibility: "PRIVATE"
      })
      if (mine >= LIMITS.maxPrivateTopicsPerUser) {
        return res.status(400).json({
          message: `You can keep up to ${LIMITS.maxPrivateTopicsPerUser} private topics. Delete one first..!`
        })
      }
    }

    if (await titleTaken(parsed.value.title, userId)) {
      return res
        .status(409)
        .json({ message: "A topic with this title already exists..!" })
    }

    // admins publish straight away, learners always start private
    const topic = await TopicModel.create({
      ...parsed.value,
      createdBy: userId,
      visibility: admin ? "PUBLIC" : "PRIVATE"
    })

    res.status(201).json({ message: "Topic created..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to create topic" })
  }
}

export const getTopics = async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query

    // everyone sees public topics, plus their own private ones
    const visibleToMe: QueryFilter<ITopic> = {
      $or: [{ visibility: { $ne: "PRIVATE" } }, { createdBy: req.user?.sub }]
    }
    const filter: QueryFilter<ITopic> = category
      ? { $and: [visibleToMe, { category: String(category) }] }
      : visibleToMe

    const topics = await TopicModel.find(filter).sort({ createdAt: -1 })
    res.status(200).json({ message: "Success", data: topics })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch topics" })
  }
}

export const getTopicById = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadVisibleTopic(req, res)
    if (!topic) return

    res.status(200).json({ message: "Success", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch topic" })
  }
}

export const updateTopic = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadVisibleTopic(req, res)
    if (!topic) return

    const userId = req.user?.sub
    const admin = isAdminReq(req)

    if (!admin) {
      // learners may only edit their own private topic
      if (!isOwner(topic, userId) || !isPrivate(topic)) {
        return res.status(403).json({ message: "Access denied..!" })
      }
      if (topic.publishStatus === "PENDING") {
        return res.status(409).json({
          message: "Cancel the publish request before editing this topic..!"
        })
      }
    }

    const parsed = parseTopicInput(req.body)
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error })
    }

    if (await titleTaken(parsed.value.title, userId, String(topic._id))) {
      return res
        .status(409)
        .json({ message: "A topic with this title already exists..!" })
    }

    topic.set(parsed.value)
    // the content changed, so an old rejection no longer applies
    if (!admin && topic.publishStatus === "REJECTED") {
      topic.publishStatus = "NONE"
      topic.rejectionReason = ""
    }
    await topic.save()

    res.status(200).json({ message: "Topic updated..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update topic" })
  }
}

export const deleteTopic = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadVisibleTopic(req, res)
    if (!topic) return

    if (!isAdminReq(req)) {
      if (!isOwner(topic, req.user?.sub) || !isPrivate(topic)) {
        return res.status(403).json({ message: "Access denied..!" })
      }
    }

    await topic.deleteOne()
    res.status(200).json({ message: "Topic deleted..!" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete topic" })
  }
}

/* ---------- learner: "Suggest to everyone" ---------- */

export const requestPublish = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadVisibleTopic(req, res)
    if (!topic) return

    if (!isOwner(topic, req.user?.sub) || !isPrivate(topic)) {
      return res
        .status(403)
        .json({ message: "Only the owner of a private topic can do this..!" })
    }
    if (topic.publishStatus === "PENDING") {
      return res
        .status(409)
        .json({ message: "This topic is already waiting for review..!" })
    }

    // somebody may have published the same title since this one was made
    const publicTwin = await TopicModel.exists({
      _id: { $ne: topic._id },
      visibility: { $ne: "PRIVATE" },
      title: new RegExp(`^${escapeRegex(topic.title)}$`, "i")
    })
    if (publicTwin) {
      return res.status(409).json({
        message: "A public topic with this title already exists..!"
      })
    }

    topic.publishStatus = "PENDING"
    topic.rejectionReason = ""
    await topic.save()

    res.status(200).json({ message: "Sent to the admin for review..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to send publish request" })
  }
}

export const cancelPublishRequest = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadVisibleTopic(req, res)
    if (!topic) return

    if (!isOwner(topic, req.user?.sub) || !isPrivate(topic)) {
      return res.status(403).json({ message: "Access denied..!" })
    }
    if (topic.publishStatus !== "PENDING") {
      return res
        .status(409)
        .json({ message: "This topic has no pending request..!" })
    }

    topic.publishStatus = "NONE"
    await topic.save()

    res.status(200).json({ message: "Request cancelled..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to cancel request" })
  }
}

/* ---------- admin: review queue ---------- */

export const listPublishRequests = async (_req: AuthRequest, res: Response) => {
  try {
    const topics = await TopicModel.find({
      visibility: "PRIVATE",
      publishStatus: "PENDING"
    })
      .sort({ updatedAt: 1 })
      .populate("createdBy", "name")

    res.status(200).json({ message: "Success", data: topics })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch requests" })
  }
}

// admin only: finds a pending request by id (private topics are otherwise hidden)
const loadPendingRequest = async (
  req: AuthRequest,
  res: Response
): Promise<ITopic | null> => {
  const id = req.params.id as string
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid topic id..!" })
    return null
  }
  const topic = await TopicModel.findById(id)
  if (!topic || !isPrivate(topic) || topic.publishStatus !== "PENDING") {
    res.status(404).json({ message: "No pending request for this topic..!" })
    return null
  }
  return topic
}

export const approveTopic = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadPendingRequest(req, res)
    if (!topic) return

    const publicTwin = await TopicModel.exists({
      _id: { $ne: topic._id },
      visibility: { $ne: "PRIVATE" },
      title: new RegExp(`^${escapeRegex(topic.title)}$`, "i")
    })
    if (publicTwin) {
      return res.status(409).json({
        message:
          "A public topic with this title already exists. Reject this request instead..!"
      })
    }

    topic.visibility = "PUBLIC"
    topic.publishStatus = "NONE"
    topic.rejectionReason = ""
    await topic.save()

    res.status(200).json({ message: "Topic is now public..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to approve topic" })
  }
}

export const rejectTopic = async (req: AuthRequest, res: Response) => {
  try {
    const topic = await loadPendingRequest(req, res)
    if (!topic) return

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : ""
    if (reason.length > 300) {
      return res
        .status(400)
        .json({ message: "Reason must be 300 characters or fewer..!" })
    }

    topic.publishStatus = "REJECTED"
    topic.rejectionReason = reason
    await topic.save()

    res.status(200).json({ message: "Request rejected..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to reject topic" })
  }
}