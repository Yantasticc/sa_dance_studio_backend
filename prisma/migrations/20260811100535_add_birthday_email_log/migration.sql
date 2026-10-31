-- CreateTable
CREATE TABLE "BirthdayEmailLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "birthdayDate" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayEmailLog_studentId_birthdayDate_key" ON "BirthdayEmailLog"("studentId", "birthdayDate");

-- AddForeignKey
ALTER TABLE "BirthdayEmailLog" ADD CONSTRAINT "BirthdayEmailLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
