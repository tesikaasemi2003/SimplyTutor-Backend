import { Response } from "express"
import { isValidObjectId } from "mongoose"
import { AuthRequest } from "../middlewares/auth"
import { TopicModel } from "../models/topic.model"
import { IQuiz, QuizModel } from "../models/quiz.model"
import { QuizAttemptModel } from "../models/quizAttempt.model"
import { ExplanationModel } from "../models/explanation.model"
import { generateQuiz } from "../services/gemini.service"
import { touchStreak } from "../utils/streak"

// never send correctIndex / explanation before the learner answers
const toPublicQuiz = (quiz: IQuiz) => ({
  id: quiz._id,
  topic: quiz.topic,
  questions: quiz.questions.map((q) => ({
    type: q.type,
    question: q.question,
    options: q.options
  }))
})

export const generateQuizForTopic = async (req: AuthRequest, res: Response) => {
  try {
    const { topicId } = req.body
    if (!isValidObjectId(topicId)) {
      return res.status(400).json({ message: "Invalid topic id..!" })
    }

    const requested = Number(req.body.count ?? 5)
    const count = Number.isInteger(requested)
      ? Math.min(10, Math.max(3, requested))
      : 5

    const topic = await TopicModel.findById(topicId)
    if (!topic) {
      return res.status(404).json({ message: "Topic not found..!" })
    }

    // target the gaps from this learner's latest explanation of the topic
    const latest = await ExplanationModel.findOne({
      user: req.user?.sub,
      topic: topic._id
    }).sort({ createdAt: -1 })
    const gaps = latest?.feedback?.gaps ?? []

    let questions
    try {
      questions = await generateQuiz(
        topic.title,
        topic.description,
        count,
        gaps
      )
    } catch (err) {
      console.error("Gemini error:", err)
      return res
        .status(502)
        .json({ message: "AI quiz generator is unavailable, try again..!" })
    }

    const quiz = await QuizModel.create({
      topic: topic._id,
      createdBy: req.user?.sub,
      questions
    })

    res.status(201).json({ message: "Quiz generated..!", data: toPublicQuiz(quiz) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to generate quiz" })
  }
}

export const getQuiz = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid quiz id..!" })
    }

    const quiz = await QuizModel.findById(id)
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found..!" })
    }

    res.status(200).json({ message: "Success", data: toPublicQuiz(quiz) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch quiz" })
  }
}

export const submitAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid quiz id..!" })
    }

    const quiz = await QuizModel.findById(id)
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found..!" })
    }

    const { answers } = req.body
    const valid =
      Array.isArray(answers) &&
      answers.length === quiz.questions.length &&
      answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 3)

    if (!valid) {
      return res.status(400).json({
        message: `answers must be an array of ${quiz.questions.length} numbers (0 to 3)..!`
      })
    }

    const total = quiz.questions.length
    const score = quiz.questions.filter(
      (q, i) => q.correctIndex === answers[i]
    ).length
    const percentage = Math.round((score / total) * 100)

    const attempt = await QuizAttemptModel.create({
      user: req.user?.sub,
      quiz: quiz._id,
      topic: quiz.topic,
      answers,
      score,
      total,
      percentage
    })

    await touchStreak(req.user?.sub)

    // correct answers are revealed only now
    const review = quiz.questions.map((q, i) => ({
      question: q.question,
      yourAnswer: answers[i],
      correctIndex: q.correctIndex,
      isCorrect: q.correctIndex === answers[i],
      explanation: q.explanation
    }))

    res.status(201).json({
      message: "Attempt saved..!",
      data: { attemptId: attempt._id, score, total, percentage, review }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to submit attempt" })
  }
}

export const getMyAttempts = async (req: AuthRequest, res: Response) => {
  try {
    const attempts = await QuizAttemptModel.find({ user: req.user?.sub })
      .populate("topic", "title category")
      .sort({ createdAt: -1 })

    res.status(200).json({ message: "Success", data: attempts })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to fetch attempts" })
  }
}