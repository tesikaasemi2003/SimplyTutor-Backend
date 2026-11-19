import { ITopic } from "../models/topic.model"

// a topic is visible to everyone unless it is PRIVATE.
// (topics saved before this feature have no visibility field = public)
export const isPrivate = (topic: Pick<ITopic, "visibility">): boolean =>
  topic.visibility === "PRIVATE"

export const isOwner = (
  topic: Pick<ITopic, "createdBy">,
  userId?: string
): boolean => !!userId && String(topic.createdBy) === userId

// the one rule every topic / explanation / quiz endpoint uses:
// public topics are open to all, private topics only to their owner
export const canAccessTopic = (
  topic: Pick<ITopic, "visibility" | "createdBy">,
  userId?: string
): boolean => !isPrivate(topic) || isOwner(topic, userId)

export const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const LIMITS = {
  title: 100,
  description: 1000,
  category: 40,
  maxPrivateTopicsPerUser: 15
}