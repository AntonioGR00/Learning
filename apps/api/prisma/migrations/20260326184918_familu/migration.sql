-- CreateEnum
CREATE TYPE "public"."EducationStage" AS ENUM ('ESO', 'BACHILLERATO', 'GRADO_MEDIO', 'GRADO_SUPERIOR');

-- CreateTable
CREATE TABLE "public"."TrainingFamily" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "public"."EducationStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingFamily_stage_idx" ON "public"."TrainingFamily"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingFamily_name_stage_key" ON "public"."TrainingFamily"("name", "stage");
