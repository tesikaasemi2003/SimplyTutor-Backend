import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET as string

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ message: "Token not found..!" })
  }

  const token = authHeader.split(" ")[1]
  try {
    req.user = jwt.verify(token, JWT_SECRET) as JwtPayload
    next()
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token..!" })
  }
}

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRoles: string[] = req.user?.roles || []
    const hasRole = allowedRoles.some((role) => userRoles.includes(role))
    if (!hasRole) {
      return res.status(403).json({ message: "Access denied..!" })
    }
    next()
  }
}