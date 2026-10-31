import * as nodemailer from "nodemailer";
import * as path from "path";
import * as fs from "fs";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface BulkEmailRecipient {
  studentId: string;
  name: string;
  email: string;
  course: string;
  batch: string;
}

export interface BulkEmailPayload {
  recipients: BulkEmailRecipient[];
  subject: string;
  messageTemplate: string;
}

// ─── Global transporter singleton (same pattern as Whispr) ───────────────────
let transporter: nodemailer.Transporter | null = null;

/**
 * Lazy-initialise Nodemailer transporter using Gmail SMTP.
 * Sender: sadancestudioakola@gmail.com (configured in backend/.env)
 */
export function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "SMTP configuration is incomplete. Set SMTP_USER and SMTP_PASSWORD in backend/.env"
    );
  }

  // Respect SMTP_SECURE env var; fall back to port-based detection
  const secureEnv = process.env.SMTP_SECURE;
  const isSecure = secureEnv !== undefined ? secureEnv === "true" : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return transporter;
}

/**
 * Verify the SMTP connection. Call this once at startup or before first send.
 */
export async function verifyConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const client = getTransporter();
    await client.verify();
    console.log("✅ Nodemailer SMTP verified — connection healthy.");
    return { ok: true };
  } catch (err: any) {
    console.error(
      `❌ Nodemailer SMTP verify failed: ${err.message || String(err)}`
    );
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Send a single email.
 *
 * FROM is always the configured sender (sadancestudioakola@gmail.com via .env).
 * TO is always the provided payload.to (e.g. student's email from PostgreSQL).
 */
export async function sendEmail(
  payload: EmailPayload
): Promise<{ success: boolean; messageId?: string; error?: any }> {
  try {
    const client = getTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || "S&A Dance Studio";
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;

    const logoPath = path.join(__dirname, "..", "assets", "logo.png");
    const attachments = [];
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: "logo.png",
        path: logoPath,
        cid: "sa-logo", // matches cid:sa-logo in html
      });
    }

    const info = await client.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ""),
      html: payload.html,
      attachments,
    });

    console.log(
      `✅ Email delivered to ${payload.to} — messageId: ${info.messageId}`
    );
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    // ─── Detailed error logging (never log SMTP_PASSWORD) ────────────────
    console.error(
      "============================================================"
    );
    console.error("EMAIL_SEND_FAILED");
    console.error(`Recipient: ${payload.to}`);
    console.error(`Code: ${error.code || "UNKNOWN"}`);
    console.error(`Message: ${error.message || "Unknown error"}`);
    if (error.response) {
      console.error(`Provider Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`Response Code: ${error.responseCode}`);
    }
    console.error(`Timestamp: ${new Date().toISOString()}`);
    console.error(
      "============================================================"
    );
    return { success: false, error };
  }
}

/**
 * Replace placeholders dynamically for a student:
 * {{name}}, {{course}}, {{batch}}, {{date}}, {{time}}, {{otp}}
 */
export function renderTemplate(
  template: string,
  variables: {
    name: string;
    course: string;
    batch: string;
    date: string;
    time: string;
    otp?: string;
  }
): string {
  let result = template;
  result = result.replace(/\{\{name\}\}/g, variables.name);
  result = result.replace(/\{\{course\}\}/g, variables.course);
  result = result.replace(/\{\{batch\}\}/g, variables.batch);
  result = result.replace(/\{\{date\}\}/g, variables.date);
  result = result.replace(/\{\{time\}\}/g, variables.time);
  if (variables.otp) {
    result = result.replace(/\{\{otp\}\}/g, variables.otp);
  }
  return result;
}
