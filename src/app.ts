import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Ensure all uploads directories exist
const uploadDirs = [
  path.join(__dirname, "../uploads"),
  path.join(__dirname, "../uploads/website"),
  path.join(__dirname, "../uploads/gallery"),
  path.join(__dirname, "../uploads/courses"),
  path.join(__dirname, "../uploads/events"),
  path.join(__dirname, "../uploads/certifications"),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Import Routes
import authRoutes from "./routes/authRoutes";
import courseRoutes from "./routes/courseRoutes";
import batchRoutes from "./routes/batchRoutes";
import studentRoutes from "./routes/studentRoutes";
import enquiryRoutes from "./routes/enquiryRoutes";
import eventRoutes from "./routes/eventRoutes";
import emailRoutes from "./routes/emailRoutes";
import birthdayEmailRoutes from "./routes/birthdayEmailRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import galleryRoutes from "./routes/galleryRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import certificationRoutes from "./routes/certificationRoutes";
import prisma from "./config/prisma";
import { verifyConnection } from "./services/emailService";
import { initBirthdayScheduler } from "./services/birthdayScheduler";

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
const allowedOrigins: string[] = [];

if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(",").forEach((url) => {
    allowedOrigins.push(url.trim().replace(/\/$/, ""));
  });
} else {
  allowedOrigins.push("http://localhost:3000");
}

if (process.env.ADMIN_PANEL_URL) {
  process.env.ADMIN_PANEL_URL.split(",").forEach((url) => {
    allowedOrigins.push(url.trim().replace(/\/$/, ""));
  });
} else {
  allowedOrigins.push("http://localhost:3001");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);

      // Allow any local host development origin
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.indexOf(cleanOrigin) !== -1 || allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation"), false);
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Route Mounts
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/enquiries", enquiryRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/messages/email", emailRoutes);
app.use("/api/v1/birthday-emails", birthdayEmailRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/gallery", galleryRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/certifications", certificationRoutes);

// Connection health checker
app.get("/api/v1/health", async (req: express.Request, res: express.Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      message: "API is running",
      database: "connected"
    });
  } catch (error: any) {
    console.error("Healthcheck database connection failed:", error);
    res.status(500).json({
      success: false,
      message: "API is running",
      database: "disconnected"
    });
  }
});

// Base route for connectivity verification
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "S&A Dance Studio Management API is operational.",
    version: "1.0.0",
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandle API error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "An internal server error occurred.",
    error: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
});

// Start Server after verifying db connection
async function startServer() {
  // Validate env variables
  if (!process.env.DATABASE_URL) {
    console.error("Required environment variable DATABASE_URL is missing!");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("Required environment variable JWT_SECRET is missing!");
    process.exit(1);
  }

  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DATABASE] Successfully connected to PostgreSQL database "sumitdance".');

    app.listen(PORT, async () => {
      console.log(`[API SERVER] Running on port ${PORT} with environment: ${process.env.NODE_ENV || "development"}`);

      // Initialize automatic birthday scheduler (00:00 AM Asia/Kolkata)
      initBirthdayScheduler();

      // Verify SMTP connection (non-blocking — server starts regardless)
      const smtpCheck = await verifyConnection();
      if (smtpCheck.ok) {
        console.log("[EMAIL] ✅ SMTP connection verified — email service is ready.");
      } else {
        console.warn(`[EMAIL] ⚠️ SMTP connection failed: ${smtpCheck.error}`);
        console.warn("[EMAIL] Email sending will fail until SMTP credentials are fixed.");
      }
    });
  } catch (error: any) {
    console.error("\n============================================================");
    console.error("Database connection failed:");
    console.error('Could not connect to PostgreSQL database "sumitdance".');
    console.error("Please verify that PostgreSQL is running on localhost:5432 and password is correct.");
    console.error("Details:", error.message);
    console.error("============================================================\n");
    process.exit(1);
  }
}

startServer();

export default app;
