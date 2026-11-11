import { Document, model, Schema, Types } from "mongoose"

export interface ITopic extends Document {
  title: string
  description: string
  category: string
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  createdBy: Types.ObjectId
}

const topicSchema = new Schema<ITopic>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      default: "BEGINNER"
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true }
  },
  { timestamps: true }
)

export const TopicModel = model<ITopic>("topics", topicSchema)