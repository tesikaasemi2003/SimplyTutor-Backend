import { Document, model, Schema } from "mongoose"

export enum UserRole {
  ADMIN = "ADMIN",
  LEARNER = "LEARNER"
}

export interface IUser extends Document {
  name: string
  email: string
  password: string
  roles: UserRole[]
  currentStreak: number
  lastActiveDate: Date | null
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    roles: {
      type: [String],
      enum: Object.values(UserRole),
      default: [UserRole.LEARNER]
    },
    currentStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null }
  },
  { timestamps: true }
)

export const UserModel = model<IUser>("users", userSchema)