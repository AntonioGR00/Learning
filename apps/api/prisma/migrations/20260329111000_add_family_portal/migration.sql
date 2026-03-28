ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FAMILY';

CREATE TABLE "FamilyStudentLink" (
    "id" SERIAL NOT NULL,
    "familyUserId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyStudentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyStudentLink_familyUserId_studentId_key" ON "FamilyStudentLink"("familyUserId", "studentId");
CREATE INDEX "FamilyStudentLink_familyUserId_idx" ON "FamilyStudentLink"("familyUserId");
CREATE INDEX "FamilyStudentLink_studentId_idx" ON "FamilyStudentLink"("studentId");

ALTER TABLE "FamilyStudentLink" ADD CONSTRAINT "FamilyStudentLink_familyUserId_fkey" FOREIGN KEY ("familyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyStudentLink" ADD CONSTRAINT "FamilyStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;