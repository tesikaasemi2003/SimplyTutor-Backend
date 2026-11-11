import { UserModel } from "../models/user.model"

export const APP_TZ = process.env.APP_TIMEZONE || "Asia/Colombo"

// "2026-11-12" style day key in the app timezone
export const dayKey = (d: Date): string =>
  d.toLocaleDateString("en-CA", { timeZone: APP_TZ })

export const dayDiff = (fromKey: string, toKey: string): number =>
  Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86400000)

export const touchStreak = async (userId?: string): Promise<void> => {
  try {
    if (!userId) return
    const user = await UserModel.findById(userId)
    if (!user) return

    const today = dayKey(new Date())

    if (user.lastActiveDate) {
      const diff = dayDiff(dayKey(user.lastActiveDate), today)
      if (diff === 0) return // already counted today
      user.currentStreak = diff === 1 ? user.currentStreak + 1 : 1
    } else {
      user.currentStreak = 1
    }

    user.lastActiveDate = new Date()
    await user.save()
  } catch (err) {
    // a streak problem must never break the main request
    console.error("touchStreak failed:", err)
  }
}