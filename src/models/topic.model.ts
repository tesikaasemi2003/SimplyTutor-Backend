import { Document, model, Schema, Types } from "mongoose"

export type TopicVisibility = "PUBLIC" | "PRIVATE"

// NONE     = no request (or the topic is already public)
// PENDING  = learner asked the admin to publish it
// REJECTED = admin said no (rejectionReason may explain why)
export type PublishStatus = "NONE" | "PENDING" | "REJECTED"

export interface ITopic extends Document {
  title: string
  description: string
  category: string
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  createdBy: Types.ObjectId
  visibility: TopicVisibility
  publishStatus: PublishStatus
  rejectionReason: string
}

const topicSchema = new Schema<ITopic>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    difficulty: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      default: "BEGINNER"
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "users", required: true },
    // old topics have no visibility field, so they count as PUBLIC
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      default: "PUBLIC"
    },
    publishStatus: {
      type: String,
      enum: ["NONE", "PENDING", "REJECTED"],
      default: "NONE"
    },
    rejectionReason: { type: String, default: "", maxlength: 300 }
  },
  { timestamps: true }
)

// fast lookups for "my topics" and the admin review queue
topicSchema.index({ createdBy: 1, visibility: 1 })
topicSchema.index({ publishStatus: 1, createdAt: 1 })

export const TopicModel = model<ITopic>("topics", topicSchema)