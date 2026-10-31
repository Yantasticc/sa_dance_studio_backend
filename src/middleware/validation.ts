import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { errorResponse } from "../utils/response";

// Rate limiting for public enquiry route
export const enquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many enquiries submitted from this IP, please try again after 15 minutes.",
    error: {
      code: "RATE_LIMIT_EXCEEDED"
    }
  }
});

// Helper validation rules
export function validateEnquiryInput(req: Request, res: Response, next: NextFunction) {
  const { name, phone, email, courseId, age } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse(res, "Full Name is required and must be a string.", "VALIDATION_FAILED");
  }

  if (!phone || typeof phone !== "string" || !/^[0-9]{10,12}$/.test(phone.replace(/[\s\-\+]/g, ""))) {
    return errorResponse(res, "Phone Number is required and must be a valid 10-12 digit mobile number.", "VALIDATION_FAILED");
  }

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(res, "Email is required and must be a valid email address.", "VALIDATION_FAILED");
  }

  if (!courseId || typeof courseId !== "string" || courseId.trim().length === 0) {
    return errorResponse(res, "Select Course is required.", "VALIDATION_FAILED");
  }

  if (age !== undefined && age !== null && age !== "") {
    const parsedAge = Number(age);
    if (isNaN(parsedAge) || parsedAge < 3 || parsedAge > 90) {
      return errorResponse(res, "Age must be a valid number between 3 and 90.", "VALIDATION_FAILED");
    }
  }

  next();
}

export function validateStudentInput(req: Request, res: Response, next: NextFunction) {
  const { fullName, phone, whatsappNumber, email, dateOfBirth, courseId, batchId } = req.body;

  if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0) {
    return errorResponse(res, "Full Name is required.", "VALIDATION_FAILED");
  }

  if (!phone || typeof phone !== "string") {
    return errorResponse(res, "Phone Number is required.", "VALIDATION_FAILED");
  }

  if (!whatsappNumber || typeof whatsappNumber !== "string") {
    return errorResponse(res, "WhatsApp Number is required.", "VALIDATION_FAILED");
  }

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(res, "Valid email address is required.", "VALIDATION_FAILED");
  }

  if (!dateOfBirth || isNaN(Date.parse(dateOfBirth))) {
    return errorResponse(res, "Valid Date of Birth is required.", "VALIDATION_FAILED");
  }

  if (!courseId) {
    return errorResponse(res, "Course Selection is required.", "VALIDATION_FAILED");
  }

  if (!batchId) {
    return errorResponse(res, "Batch Selection is required.", "VALIDATION_FAILED");
  }

  next();
}
