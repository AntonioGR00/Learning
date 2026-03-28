-- CreateEnum
CREATE TYPE "AssignmentDeliveryMode" AS ENUM ('PLATFORM', 'FILE_UPLOAD');

-- AlterTable
ALTER TABLE "Assignment"
ADD COLUMN "deliveryMode" "AssignmentDeliveryMode" NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "Submission"
ADD COLUMN "fileUrl" TEXT;
