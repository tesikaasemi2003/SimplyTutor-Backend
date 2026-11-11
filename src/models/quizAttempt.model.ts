import { Document, model, Schema, Types } from "mongoose"

export interface IQuizAttempt extends Document {
  user: Types.ObjectId
  quiz: Types.ObjectId
  topic: Types.ObjectId
  answers: number[]
  score: number
  total: number
  percentage: number
}

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    user: { type: Schema.Types.ObjectId, ref: "users", required: true },
    quiz: { type: Schema.Types.ObjectId, ref: "quizzes", required: true },
    topic: { type: Schema.Types.ObjectId, ref: "topics", required: true },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true }
  },
  { timestamps: true }
)

export const QuizAttemptModel = model<IQuizAttempt>(
  "quizattempts",
  quizAttemptSchema
)