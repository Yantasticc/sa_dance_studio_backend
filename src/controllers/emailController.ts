import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth";
import {
  sendEmail,
  renderTemplate,
  getTransporter,
  verifyConnection,
} from "../services/emailService";
import {
  getStudentEmailTemplate,
  getBaseEmailTemplate,
} from "../utils/emailTemplates";

export async function previewCampaign(req: Request, res: Response) {
  const { studentIds, subject, message } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return errorResponse(
      res,
      "Recipient student IDs are required.",
      "INVALID_INPUT"
    );
  }
  if (!subject || !message) {
    return errorResponse(
      res,
      "Subject and message template are required.",
      "INVALID_INPUT"
    );
  }

  try {
    // Fetch first student to render sample template
    const student = await prisma.student.findUnique({
      where: { id: studentIds[0] },
      include: { course: true, batch: true },
    });

    if (!student) {
      return errorResponse(
        res,
        "Sample student recipient not found.",
        "NOT_FOUND",
        null,
        404
      );
    }

    const todayStr = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const renderedBody = renderTemplate(message, {
      name: student.fullName,
      course: student.course.name,
      batch: student.batch.name,
      date: todayStr,
      time: `${student.batch.startTime} - ${student.batch.endTime}`,
    });

    const baseHtml = getStudentEmailTemplate();
    const renderedHtml = renderTemplate(baseHtml.replace("{{message}}", renderedBody.replace(/\n/g, "<br />")), {
      name: student.fullName,
      course: student.course.name,
      batch: student.batch.name,
      date: todayStr,
      time: `${student.batch.startTime} - ${student.batch.endTime}`,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const previewMessageHTML = renderedHtml.replace("cid:sa-logo", `${frontendUrl}/images/logo/logo.png`);

    return successResponse(res, "Template preview generated.", {
      sampleRecipient: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
      },
      previewSubject: subject,
      previewMessage: previewMessageHTML, // Now returning HTML preview for the UI
    });
  } catch (error) {
    console.error("previewCampaign error:", error);
    return errorResponse(
      res,
      "Failed to generate campaign preview.",
      "INTERNAL_ERROR",
      null,
      500
    );
  }
}

export async function sendBulkEmail(req: AuthRequest, res: Response) {
  const { studentIds, subject, message } = req.body;
  const adminUser = req.admin?.name || "admin";

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return errorResponse(
      res,
      "At least one recipient student ID is required.",
      "INVALID_INPUT"
    );
  }
  if (!subject || !message) {
    return errorResponse(
      res,
      "Subject and message are required.",
      "INVALID_INPUT"
    );
  }

  try {
    // 0. Verify SMTP connection before attempting sends
    const smtpCheck = await verifyConnection();
    if (!smtpCheck.ok) {
      return errorResponse(
        res,
        `SMTP connection failed: ${smtpCheck.error}`,
        "SMTP_CONNECTION_FAILED",
        null,
        500
      );
    }

    // 1. Fetch all student recipients with emails
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { course: true, batch: true },
    });

    if (students.length === 0) {
      return errorResponse(
        res,
        "No student records matched the provided recipient IDs.",
        "NOT_FOUND",
        null,
        404
      );
    }

    // 2. Filter students into valid and invalid email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validStudents = [];
    const invalidStudents = [];

    for (const student of students) {
      if (student.email && emailRegex.test(student.email.trim())) {
        validStudents.push(student);
      } else {
        invalidStudents.push(student);
      }
    }

    if (validStudents.length === 0) {
      return errorResponse(
        res,
        "No valid email addresses found among selected students.",
        "INVALID_EMAILS",
        null,
        400
      );
    }

    // 3. Create EmailCampaign record
    const courseId = validStudents[0].courseId; // Default to first recipient's course
    const campaign = await prisma.emailCampaign.create({
      data: {
        subject,
        message,
        courseId,
        createdBy: adminUser,
        totalRecipients: students.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    const recipientLogs: any[] = [];

    // Pre-record invalid email addresses as FAILED directly
    for (const student of invalidStudents) {
      failedCount++;
      recipientLogs.push({
        campaignId: campaign.id,
        studentId: student.id,
        email: student.email || "No Email",
        status: "FAILED" as const,
        errorMessage: "Invalid email address format",
      });
    }

    // 4. Send emails sequentially to replace placeholders and record results
    const todayStr = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    for (const student of validStudents) {
      const renderedBody = renderTemplate(message, {
        name: student.fullName,
        course: student.course.name,
        batch: student.batch.name,
        date: todayStr,
        time: `${student.batch.startTime} - ${student.batch.endTime}`,
      });

      const baseHtml = getStudentEmailTemplate();
      const renderedHtml = renderTemplate(baseHtml.replace("{{message}}", renderedBody.replace(/\n/g, "<br />")), {
        name: student.fullName,
        course: student.course.name,
        batch: student.batch.name,
        date: todayStr,
        time: `${student.batch.startTime} - ${student.batch.endTime}`,
      });

      const result = await sendEmail({
        to: student.email, 
        subject,
        html: renderedHtml,
        text: renderedBody,
      });

      if (result.success) {
        sentCount++;
        recipientLogs.push({
          campaignId: campaign.id,
          studentId: student.id,
          email: student.email,
          status: "SENT" as const,
          sentAt: new Date(),
        });
      } else {
        failedCount++;
        recipientLogs.push({
          campaignId: campaign.id,
          studentId: student.id,
          email: student.email,
          status: "FAILED" as const,
          errorMessage:
            result.error?.message || "Unknown SMTP delivery failure",
        });
      }
    }

    // 5. Save recipient logs in database
    await prisma.emailRecipient.createMany({
      data: recipientLogs.map((log) => ({
        campaignId: log.campaignId,
        studentId: log.studentId,
        email: log.email,
        status: log.status,
        errorMessage: log.errorMessage || null,
        sentAt: log.sentAt || null,
      })),
    });

    // 6. Update campaign counts
    const updatedCampaign = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount,
        failedCount,
      },
    });

    return successResponse(res, "Email campaign processed", {
      campaignId: updatedCampaign.id,
      total: students.length,
      sent: sentCount,
      failed: failedCount,
      results: recipientLogs.map((log) => ({
        studentId: log.studentId,
        email: log.email,
        status: log.status,
        reason: log.errorMessage || null,
      })),
    });
  } catch (error) {
    console.error("sendBulkEmail error:", error);
    return errorResponse(
      res,
      "An error occurred during bulk email sending.",
      "INTERNAL_SERVER_ERROR",
      null,
      500
    );
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const history = await prisma.emailCampaign.findMany({
      include: {
        course: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, "Email campaign history fetched.", history);
  } catch (error) {
    console.error("getHistory error:", error);
    return errorResponse(
      res,
      "Failed to fetch history.",
      "DB_ERROR",
      null,
      500
    );
  }
}

export async function getHistoryById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        course: true,
        recipients: {
          include: {
            student: true,
          },
        },
      },
    });
    if (!campaign) {
      return errorResponse(res, "Campaign not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Campaign details retrieved.", campaign);
  } catch (error) {
    console.error("getHistoryById error:", error);
    return errorResponse(
      res,
      "Failed to fetch campaign details.",
      "DB_ERROR",
      null,
      500
    );
  }
}

export async function checkEmailHealth(req: Request, res: Response) {
  try {
    const check = await verifyConnection();
    return res.status(200).json({
      success: check.ok,
      data: {
        configured: true,
        connection: check.ok ? "healthy" : "unavailable",
        error: check.error || null,
      },
    });
  } catch (error: any) {
    console.error("SMTP health check failed:", error);
    return res.status(200).json({
      success: false,
      data: {
        configured: !!process.env.SMTP_HOST,
        connection: "unavailable",
        error: error.message || String(error),
      },
    });
  }
}

export async function testEmail(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) {
    return errorResponse(
      res,
      "Test email address is required.",
      "INVALID_INPUT",
      null,
      400
    );
  }

  try {
    // Verify transport first
    const check = await verifyConnection();
    if (!check.ok) {
      return errorResponse(
        res,
        `SMTP connection failed before sending: ${check.error}`,
        "SMTP_CONNECTION_FAILED",
        null,
        500
      );
    }

    const result = await sendEmail({
      to: email,
      subject: "S&A Dance Studio - Email System Test",
      html: getBaseEmailTemplate(`
        <p>Hello,</p>
        <p>This is a test email from the <strong>S&A Dance Studio management system</strong>.</p>
        <div class="message-box">
          The email service is working correctly.
        </div>
      `),
      text: `Hello,\n\nThis is a test email from the S&A Dance Studio management system.\n\nThe email service is working correctly.\n\nRegards,\nSandip Wasnik\nS&A Dance Studio`,
    });

    if (result.success) {
      return successResponse(res, "Test email sent successfully.", {
        accepted: true,
        messageId: result.messageId,
      });
    } else {
      return errorResponse(
        res,
        `Failed to deliver test email: ${result.error?.message || "Unknown SMTP error"}`,
        "SMTP_FAILED",
        { code: result.error?.code, response: result.error?.response },
        500
      );
    }
  } catch (error: any) {
    console.error("Test email sending failed:", error);
    return errorResponse(
      res,
      `SMTP provider error: ${error.message || String(error)}`,
      "SMTP_ERROR",
      null,
      500
    );
  }
}
