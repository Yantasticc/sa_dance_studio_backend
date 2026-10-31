import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth";
import { sendEmail } from "../services/emailService";
import { getBaseEmailTemplate } from "../utils/emailTemplates";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return errorResponse(res, "Email and password are required.", "INVALID_INPUT", null, 400);
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return errorResponse(res, "Invalid email or password.", "INVALID_CREDENTIALS", null, 401);
    }
    if (!admin.isActive) {
      return errorResponse(res, "Admin account is inactive.", "ACCOUNT_INACTIVE", null, 403);
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return errorResponse(res, "Invalid email or password.", "INVALID_CREDENTIALS", null, 401);
    }

    const jwtSecret = process.env.JWT_SECRET || "sa_dance_studio_super_secret_jwt_key_2026";
    const token = jwt.sign(
      { id: admin.id, name: admin.name, email: admin.email },
      jwtSecret,
      { expiresIn: "1d" }
    );

    return successResponse(res, "Login successful.", {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(res, "An error occurred during login. Please check database connection or credentials.", "INTERNAL_SERVER_ERROR", null, 500);
  }
}

export async function logout(req: Request, res: Response) {
  return successResponse(res, "Logout successful.");
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.admin) {
    return errorResponse(res, "Unauthorized.", "UNAUTHORIZED", null, 401);
  }
  return successResponse(res, "Admin profile retrieved.", { admin: req.admin });
}

/**
 * POST /api/v1/auth/forgot-password
 *
 * Generates a 6-digit OTP, stores it on the Admin record, and
 * sends the OTP via the SAME email service used for bulk emails
 * (sender: sadancestudioakola@gmail.com via backend/.env).
 */
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) {
    return errorResponse(res, "Email is required.", "INVALID_INPUT", null, 400);
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      // Don't reveal whether the email exists
      return successResponse(res, "If an account exists with this email, an OTP has been sent.");
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP on Admin record
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: otpExpiry,
      },
    });

    // Send OTP email using the SAME email service (same sender account)
    const result = await sendEmail({
      to: admin.email,
      subject: "S&A Dance Studio - Password Reset OTP",
      html: getBaseEmailTemplate(`
        <p>Hello <strong>${admin.name}</strong>,</p>
        <p>We received a request to reset your S&A Dance Studio admin account password.</p>
        <p>Your OTP is:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E91E8C;">${otp}</span>
        </div>
        <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      `),
      text: `Hello ${admin.name},\n\nWe received a request to reset your S&A Dance Studio admin account password.\n\nYour OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nRegards,\nSandip Wasnik\nS&A Dance Studio`,
    });

    if (!result.success) {
      console.error("Failed to send OTP email:", result.error?.message);
      return errorResponse(res, "Failed to send OTP email. Please try again.", "EMAIL_FAILED", null, 500);
    }

    return successResponse(res, "If an account exists with this email, an OTP has been sent.");
  } catch (error) {
    console.error("forgotPassword error:", error);
    return errorResponse(res, "An error occurred. Please try again later.", "INTERNAL_SERVER_ERROR", null, 500);
  }
}

/**
 * POST /api/v1/auth/reset-password
 *
 * Verifies the OTP, resets the password.
 */
export async function resetPassword(req: Request, res: Response) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return errorResponse(res, "Email, OTP, and new password are required.", "INVALID_INPUT", null, 400);
  }

  if (newPassword.length < 6) {
    return errorResponse(res, "Password must be at least 6 characters.", "INVALID_INPUT", null, 400);
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return errorResponse(res, "Invalid OTP or email.", "INVALID_OTP", null, 400);
    }

    // Check OTP match
    if (admin.resetOtp !== otp) {
      return errorResponse(res, "Invalid OTP.", "INVALID_OTP", null, 400);
    }

    // Check OTP expiry
    if (!admin.resetOtpExpiry || new Date() > admin.resetOtpExpiry) {
      return errorResponse(res, "OTP has expired. Please request a new one.", "OTP_EXPIRED", null, 400);
    }

    // Hash new password and clear OTP
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        resetOtp: null,
        resetOtpExpiry: null,
      },
    });

    return successResponse(res, "Password has been reset successfully. You can now log in with your new password.");
  } catch (error) {
    console.error("resetPassword error:", error);
    return errorResponse(res, "An error occurred. Please try again later.", "INTERNAL_SERVER_ERROR", null, 500);
  }
}
