import { Response } from "express"
import { isValidObjectId } from "mongoose"
import { AuthRequest } from "../middlewares/auth"
import { TopicModel } from "../models/topic.model"
import { ExplanationModel } from "../models/explanation.model"
import { evaluateExplanation } from "../services/gemini.service"
import { touchStreak } from "../utils/streak"

export const submitExplanation = async (req: AuthRequest, res: Response) => {
  try {
    const { topicId, text } = req.body

    if (!isValidObjectId(topicId)) {
      return res.status(400).json({ message: "Invalid topic id..!" })
    }
    if (typeof text !== "string" || text.trim().length < 30) {
      return res
        .status(400)
        .json({ message: "Explanation must be at least 30 characters..!" })
    }
    if (text.length > 3000) {
      return res
        .status(400)
        .json({ message: "Explanation must be under 3000 characters..!" })
    }

    const topic = await TopicModel.findById(topicId)
    if (!topic) {
      return res.status(404).json({ message: "Topic not found..!" })
    }

    let feedback
    try {
      feedback = await evaluateExplanation(
        topic.title,
        topic.description,
        text.trim()
      )
    } catch (err) {
      console.error("Gemini error:", err)
      return res
        .status(502)
        .json({ message: "AI tutor is unavailable, try again shortly..!" })
    }

    const explanation = await ExplanationModel.create({
      user: req.user?.sub,
      topic: topic._id,
      text: text.trim(),
      feedback
    })

    await touchStreak(req.user?.sub)

    res.status(201).json({ message: "Evaluated..!", data: explanation })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to submit explanation" })
  }
}

export const getMyExplanations = async (req: AuthRequest, res: Response) => {
  try {
    const explanations = await ExplanationModel.find({ user: req.user?.sub })
      .populate("topic", "title category")
      .sort({ createdAt: -1 })

    res.status(200).json({ message: "Success", data: explanations })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch explanations" })
  }
}