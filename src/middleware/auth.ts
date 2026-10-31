import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { errorResponse } from "../utils/response";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    name: string;
    email: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Access denied. No token provided.", "UNAUTHORIZED", null, 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const jwtSecret = process.env.JWT_SECRET || "sa_dance_studio_super_secret_jwt_key_2026";
    const decoded = jwt.verify(token, jwtSecret) as { id: string; name: string; email: string };
    req.admin = decoded;
    next();
  } catch (error) {
    return errorResponse(res, "Invalid or expired token.", "INVALID_TOKEN", null, 401);
  }
}
