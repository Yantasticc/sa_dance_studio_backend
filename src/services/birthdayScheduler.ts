import cron from "node-cron";
import { runBirthdayEmailJob } from "./birthdayEmailService";

/**
 * Initializes the automatic birthday email scheduler.
 * Executes daily at 00:00 AM (midnight) IST in Asia/Kolkata timezone.
 */
export function initBirthdayScheduler() {
  const schedulePattern = "0 0 * * *"; // Midnight daily
  const timezone = "Asia/Kolkata";

  console.log("============================================================");
  console.log("Birthday scheduler initialized.");
  console.log(`Timezone: ${timezone}`);
  console.log(`Schedule: 00:00 daily (${schedulePattern})`);
  console.log("============================================================");

  cron.schedule(
    schedulePattern,
    async () => {
      console.log("[CRON JOB] Triggering daily birthday email execution at 00:00 AM IST...");
      try {
        await runBirthdayEmailJob();
      } catch (err: any) {
        console.error("[CRON JOB ERROR] Birthday email job failed:", err.message || err);
      }
    },
    {
      timezone,
    }
  );
}
