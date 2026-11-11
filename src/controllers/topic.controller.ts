import { Response } from "express"
import { isValidObjectId } from "mongoose"
import { TopicModel } from "../models/topic.model"
import { AuthRequest } from "../middlewares/auth"

export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, difficulty } = req.body
    if (!title || !description || !category) {
      return res
        .status(400)
        .json({ message: "title, description and category are required..!" })
    }

    const topic = await TopicModel.create({
      title,
      description,
      category,
      difficulty,
      createdBy: req.user?.sub
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
    const filter = category ? { category: String(category) } : {}

    const topics = await TopicModel.find(filter).sort({ createdAt: -1 })
    res.status(200).json({ message: "Success", data: topics })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch topics" })
  }
}

export const getTopicById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid topic id..!" })
    }

    const topic = await TopicModel.findById(id)
    if (!topic) {
      return res.status(404).json({ message: "Topic not found..!" })
    }

    res.status(200).json({ message: "Success", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch topic" })
  }
}

export const updateTopic = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid topic id..!" })
    }

    const { title, description, category, difficulty } = req.body

    const topic = await TopicModel.findByIdAndUpdate(
      id,
      { title, description, category, difficulty },
      { new: true, runValidators: true }
    )
    if (!topic) {
      return res.status(404).json({ message: "Topic not found..!" })
    }

    res.status(200).json({ message: "Topic updated..!", data: topic })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update topic" })
  }
}

export const deleteTopic = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid topic id..!" })
    }

    const topic = await TopicModel.findByIdAndDelete(id)
    if (!topic) {
      return res.status(404).json({ message: "Topic not found..!" })
    }

    res.status(200).json({ message: "Topic deleted..!" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to delete topic" })
  }
}