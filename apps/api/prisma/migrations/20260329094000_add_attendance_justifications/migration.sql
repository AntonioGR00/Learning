CREATE TYPE "AttendanceJustificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Attendance"
ADD COLUMN "justificationUrl" TEXT,
ADD COLUMN "justificationMessage" TEXT,
ADD COLUMN "justificationStatus" "AttendanceJustificationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "justificationReviewComment" TEXT,
ADD COLUMN "justificationReviewedAt" TIMESTAMP(3);