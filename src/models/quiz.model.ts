import { Document, model, Schema, Types } from "mongoose"

export interface IQuizQuestion {
  type: "MCQ" | "SCENARIO"
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface IQuiz extends Document {
  topic: Types.ObjectId
  createdBy: Types.ObjectId
  questions: IQuizQuestion[]
}

const questionSchema = new Schema<IQuizQuestion>(
  {
    type: { type: String, enum: ["MCQ", "SCENARIO"], default: "MCQ" },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: "" }
  },
  { _id: false }
)

const quizSchema = new Schema<IQuiz>(
  {
    topic: { type: Schema.Types.ObjectId, ref: "topics", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
    questions: { type: [questionSchema], required: true }
  },
  { timestamps: true }
)

export const QuizModel = model<IQuiz>("quizzes", quizSchema)