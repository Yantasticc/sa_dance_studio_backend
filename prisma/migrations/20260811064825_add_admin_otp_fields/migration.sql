-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "resetOtp" TEXT,
ADD COLUMN     "resetOtpExpiry" TIMESTAMP(3);
