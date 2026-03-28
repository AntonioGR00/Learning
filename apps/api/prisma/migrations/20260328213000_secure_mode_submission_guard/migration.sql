-- Add secure assignment mode and persisted termination/disqualification metadata
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DISQUALIFIED';

ALTER TABLE "Assignment"
ADD COLUMN "secureMode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Submission"
ADD COLUMN "terminatedAt" TIMESTAMP(3),
ADD COLUMN "terminationReason" TEXT;
