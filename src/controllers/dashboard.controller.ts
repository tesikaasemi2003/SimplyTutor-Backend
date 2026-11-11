import { Response } from "express"
import { PipelineStage, Types } from "mongoose"
import { AuthRequest } from "../middlewares/auth"
import { UserModel } from "../models/user.model"
import { TopicModel } from "../models/topic.model"
import { ExplanationModel } from "../models/explanation.model"
import { QuizAttemptModel } from "../models/quizAttempt.model"
import { APP_TZ, dayDiff, dayKey } from "../utils/streak"

type Stat = {
  avgQuiz: number | null
  attempts: number
  avgClarity: number | null
  explanations: number
}

const calcMastery = (quiz: number | null, clarity: number | null): number => {
  if (quiz !== null && clarity !== null) {
    return Math.round(quiz * 0.6 + clarity * 0.4)
  }
  if (quiz !== null) return Math.round(quiz)
  if (clarity !== null) return Math.round(clarity)
  return 0
}

const levelOf = (mastery: number): string =>
  mastery >= 80 ? "MASTERED" : mastery >= 50 ? "LEARNING" : "NEEDS_WORK"

export const getMyDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const sub = req.user?.sub
    if (!sub) {
      return res.status(401).json({ message: "Invalid token..!" })
    }
    const userId = new Types.ObjectId(sub)

    // 1. streak (a streak that was not continued yesterday or today is 0)
    const user = await UserModel.findById(sub).select(
      "currentStreak lastActiveDate"
    )
    let currentStreak = 0
    if (user?.lastActiveDate) {
      const gap = dayDiff(dayKey(user.lastActiveDate), dayKey(new Date()))
      currentStreak = gap <= 1 ? user.currentStreak : 0
    }

    // 2. per-topic stats
    const [quizByTopic, clarityByTopic] = await Promise.all([
      QuizAttemptModel.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: "$topic",
            avgQuiz: { $avg: "$percentage" },
            attempts: { $sum: 1 }
          }
        }
      ]),
      ExplanationModel.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: "$topic",
            avgClarity: { $avg: "$feedback.clarityScore" },
            explanations: { $sum: 1 }
          }
        }
      ])
    ])

    const stats = new Map<string, Stat>()
    const getStat = (id: string): Stat => {
      let s = stats.get(id)
      if (!s) {
        s = { avgQuiz: null, attempts: 0, avgClarity: null, explanations: 0 }
        stats.set(id, s)
      }
      return s
    }

    for (const row of quizByTopic) {
      const s = getStat(String(row._id))
      s.avgQuiz = row.avgQuiz
      s.attempts = row.attempts
    }
    for (const row of clarityByTopic) {
      const s = getStat(String(row._id))
      s.avgClarity = row.avgClarity
      s.explanations = row.explanations
    }

    const topicDocs = await TopicModel.find({
      _id: { $in: [...stats.keys()] }
    }).select("title category")

    const topics = topicDocs
      .map((t) => {
        const s = getStat(String(t._id))
        const mastery = calcMastery(s.avgQuiz, s.avgClarity)
        return {
          topicId: t._id,
          title: t.title,
          category: t.category,
          avgQuizScore: s.avgQuiz === null ? null : Math.round(s.avgQuiz),
          avgClarityScore:
            s.avgClarity === null ? null : Math.round(s.avgClarity),
          attempts: s.attempts,
          explanations: s.explanations,
          mastery,
          level: levelOf(mastery)
        }
      })
      .sort((a, b) => b.mastery - a.mastery)

    // 3. totals (weighted by number of attempts / explanations)
    let totalAttempts = 0
    let quizSum = 0
    let totalExplanations = 0
    let claritySum = 0
    for (const s of stats.values()) {
      totalAttempts += s.attempts
      quizSum += (s.avgQuiz ?? 0) * s.attempts
      totalExplanations += s.explanations
      claritySum += (s.avgClarity ?? 0) * s.explanations
    }

    // 4. activity for the last 7 days (for the chart)
    const since = new Date(Date.now() - 7 * 86400000)
    const dailyStage: PipelineStage[] = [
      { $match: { user: userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timeZone: APP_TZ
            }
          },
          count: { $sum: 1 }
        }
      }
    ]

    const [dailyExplanations, dailyAttempts] = await Promise.all([
      ExplanationModel.aggregate(dailyStage),
      QuizAttemptModel.aggregate(dailyStage)
    ])

    const activityLast7Days = []
    for (let i = 6; i >= 0; i--) {
      const key = dayKey(new Date(Date.now() - i * 86400000))
      activityLast7Days.push({
        date: key,
        explanations: dailyExplanations.find((d) => d._id === key)?.count ?? 0,
        quizzes: dailyAttempts.find((d) => d._id === key)?.count ?? 0
      })
    }

    // 5. latest quiz attempts
    const recentAttempts = await QuizAttemptModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("topic", "title")
      .select("score total percentage topic createdAt")

    res.status(200).json({
      message: "Success",
      data: {
        streak: {
          current: currentStreak,
          lastActiveDate: user?.lastActiveDate ?? null
        },
        totals: {
          explanations: totalExplanations,
          quizAttempts: totalAttempts,
          avgQuizScore: totalAttempts ? Math.round(quizSum / totalAttempts) : 0,
          avgClarityScore: totalExplanations
            ? Math.round(claritySum / totalExplanations)
            : 0
        },
        topics,
        activityLast7Days,
        recentAttempts
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to load dashboard" })
  }
}