import { Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { UserModel, UserRole } from "../models/user.model"
import { signAccessToken, signRefreshToken } from "../utils/token"
import { AuthRequest } from "../middlewares/auth"

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required..!" })
    }

    const existing = await UserModel.findOne({ email })
    if (existing) {
      return res.status(400).json({ message: "User already exists..!" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await UserModel.create({
      name,
      email,
      password: hashedPassword,
      roles: [UserRole.LEARNER]
    })

    res.status(201).json({ message: "User registered successfully..!" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Registration failed" })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: "Email or password missing..!" })
    }

    const user = await UserModel.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials..!" })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials..!" })
    }

    res.status(200).json({
      message: "Success",
      data: {
        email: user.email,
        roles: user.roles,
        access_token: signAccessToken(user),
        refresh_token: signRefreshToken(user)
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Login failed" })
  }
}

export const getMyDetails = async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user?.sub).select("-password")
    if (!user) {
      return res.status(404).json({ message: "User not found..!" })
    }

    res.status(200).json({
      message: "Success",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        currentStreak: user.currentStreak
      }
    })
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" })
  }
}

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ message: "Token not found..!" })
    }

    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET)
    const user = await UserModel.findById(payload.sub)
    if (!user) {
      return res.status(403).json({ message: "Invalid or expired token..!" })
    }

    res.status(200).json({ data: { accessToken: signAccessToken(user) } })
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token..!" })
  }
}