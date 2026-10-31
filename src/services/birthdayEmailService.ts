import prisma from "../config/prisma";
import { sendEmail } from "./emailService";
import { getBaseEmailTemplate } from "../utils/emailTemplates";

export interface BirthdayJobResult {
  timezone: string;
  dateStr: string;
  totalBirthdays: number;
  sent: number;
  failed: number;
  alreadySent: number;
  details: Array<{
    studentId: string;
    studentName: string;
    email: string;
    status: "SENT" | "FAILED" | "ALREADY_SENT";
    errorMessage?: string;
  }>;
}

/**
 * Returns current date info strictly in Asia/Kolkata timezone.
 */
export function getKolkataDateInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  let year = "";
  let month = "";
  let day = "";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value.padStart(2, "0");
    if (part.type === "day") day = part.value.padStart(2, "0");
  }
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
  return {
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    day: parseInt(day, 10),
    dateStr,
  };
}

/**
 * Main reusable birthday email job function.
 * Executed daily at 12:00 AM IST by node-cron, or on-demand via API test route.
 */
export async function runBirthdayEmailJob(): Promise<BirthdayJobResult> {
  const todayInfo = getKolkataDateInfo();
  const timezone = "Asia/Kolkata";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const logoUrl = process.env.EMAIL_LOGO_URL || `${baseUrl}/images/logo/logo.png`;

  console.log(`[BIRTHDAY JOB] Executing birthday email job for ${todayInfo.dateStr} (${timezone})...`);

  // 1. Fetch active students
  const activeStudents = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: { course: true, batch: true },
  });

  // 2. Filter students whose dateOfBirth (month & day) matches today's India date
  const birthdayStudents = activeStudents.filter((student) => {
    if (!student.dateOfBirth) return false;
    const dob = new Date(student.dateOfBirth);
    const dobMonth = dob.getUTCMonth() + 1;
    const dobDay = dob.getUTCDate();
    return dobMonth === todayInfo.month && dobDay === todayInfo.day;
  });

  let sentCount = 0;
  let failedCount = 0;
  let alreadySentCount = 0;
  const details: BirthdayJobResult["details"] = [];

  // 3. Process each birthday student sequentially
  for (const student of birthdayStudents) {
    // Check if email was already sent today (duplicate protection)
    const existingLog = await prisma.birthdayEmailLog.findUnique({
      where: {
        studentId_birthdayDate: {
          studentId: student.id,
          birthdayDate: todayInfo.dateStr,
        },
      },
    });

    if (existingLog && existingLog.status === "SENT") {
      alreadySentCount++;
      details.push({
        studentId: student.id,
        studentName: student.fullName,
        email: student.email,
        status: "ALREADY_SENT",
      });
      continue;
    }

    // Validate email
    if (!student.email || !emailRegex.test(student.email.trim())) {
      failedCount++;
      const errorMsg = "Invalid or missing email address";
      await prisma.birthdayEmailLog.upsert({
        where: {
          studentId_birthdayDate: {
            studentId: student.id,
            birthdayDate: todayInfo.dateStr,
          },
        },
        create: {
          studentId: student.id,
          birthdayDate: todayInfo.dateStr,
          email: student.email || "No Email",
          status: "FAILED",
          errorMessage: errorMsg,
        },
        update: {
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
      details.push({
        studentId: student.id,
        studentName: student.fullName,
        email: student.email || "No Email",
        status: "FAILED",
        errorMessage: errorMsg,
      });
      continue;
    }

    // Build branded HTML birthday email
    const subject = "🎉 Happy Birthday from S&A Dance Studio!";
    const html = getBaseEmailTemplate(`
      <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${student.fullName},</p>
      <div class="message-box" style="background: linear-gradient(135deg, rgba(233,30,140,0.08), rgba(212,160,23,0.08)); border-left: 4px solid #E91E8C; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <p style="font-size: 18px; font-weight: bold; color: #E91E8C; margin: 0 0 8px;">🎉 Wishing you a very Happy Birthday! 🎉</p>
        <p style="font-size: 14px; color: #333333; margin: 0; line-height: 1.6;">May your special day be filled with happiness, energy and wonderful moments.</p>
      </div>
      <p style="font-size: 15px; color: #111111; font-weight: 600;">Keep dancing and keep shining! 💃🕺</p>
      <p style="font-size: 14px; color: #5C5850;">We hope you have an amazing year ahead.</p>
    `);

    const text = `Hello ${student.fullName},\n\n🎉 Wishing you a very Happy Birthday! 🎉\n\nMay your special day be filled with happiness, energy and wonderful moments.\n\nKeep dancing and keep shining! 💃✨\n\nWe hope you have an amazing year ahead.\n\nRegards,\nSandip Wasnik\nS&A Dance Studio`;

    // Send email via existing email service (sadancestudioakola@gmail.com)
    const sendResult = await sendEmail({
      to: student.email,
      subject,
      html,
      text,
    });

    if (sendResult.success) {
      sentCount++;
      await prisma.birthdayEmailLog.upsert({
        where: {
          studentId_birthdayDate: {
            studentId: student.id,
            birthdayDate: todayInfo.dateStr,
          },
        },
        create: {
          studentId: student.id,
          birthdayDate: todayInfo.dateStr,
          email: student.email,
          status: "SENT",
          sentAt: new Date(),
        },
        update: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      details.push({
        studentId: student.id,
        studentName: student.fullName,
        email: student.email,
        status: "SENT",
      });
    } else {
      failedCount++;
      const errorMsg = sendResult.error?.message || "SMTP delivery failure";
      await prisma.birthdayEmailLog.upsert({
        where: {
          studentId_birthdayDate: {
            studentId: student.id,
            birthdayDate: todayInfo.dateStr,
          },
        },
        create: {
          studentId: student.id,
          birthdayDate: todayInfo.dateStr,
          email: student.email,
          status: "FAILED",
          errorMessage: errorMsg,
        },
        update: {
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
      details.push({
        studentId: student.id,
        studentName: student.fullName,
        email: student.email,
        status: "FAILED",
        errorMessage: errorMsg,
      });
    }
  }

  console.log("============================================================");
  console.log("Birthday Email Job Completed");
  console.log(`Timezone: ${timezone}`);
  console.log(`Date: ${todayInfo.dateStr}`);
  console.log(`Birthday Students: ${birthdayStudents.length}`);
  console.log(`Sent: ${sentCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Already Sent: ${alreadySentCount}`);
  console.log("============================================================");

  return {
    timezone,
    dateStr: todayInfo.dateStr,
    totalBirthdays: birthdayStudents.length,
    sent: sentCount,
    failed: failedCount,
    alreadySent: alreadySentCount,
    details,
  };
}
