import { Document, model, Schema, Types } from "mongoose"

export interface IExplanation extends Document {
  user: Types.ObjectId
  topic: Types.ObjectId
  text: string
  feedback: {
    clarityScore: number
    summary: string
    misconceptions: string[]
    gaps: string[]
    suggestions: string[]
  }
}

const explanationSchema = new Schema<IExplanation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "users", required: true },
    topic: { type: Schema.Types.ObjectId, ref: "topics", required: true },
    text: { type: String, required: true },
    feedback: {
      clarityScore: { type: Number, required: true },
      summary: { type: String, default: "" },
      misconceptions: { type: [String], default: [] },
      gaps: { type: [String], default: [] },
      suggestions: { type: [String], default: [] }
    }
  },
  { timestamps: true }
)

export const ExplanationModel = model<IExplanation>(
  "explanations",
  explanationSchema
)