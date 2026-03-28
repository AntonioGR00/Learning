-- Store auto-extracted questions from uploaded .docx assignments
ALTER TABLE "Assignment"
ADD COLUMN "questions" JSONB;
