-- AlterTable
ALTER TABLE "interview_links" ADD COLUMN "job_id" TEXT;
ALTER TABLE "interview_links" ADD COLUMN "job_title" TEXT;
ALTER TABLE "interview_links" ADD COLUMN "machine_questions" TEXT;
ALTER TABLE "interview_links" ADD COLUMN "max_interview_questions" INTEGER;
ALTER TABLE "interview_links" ADD COLUMN "max_machine_coding_questions" INTEGER;
ALTER TABLE "interview_links" ADD COLUMN "role" TEXT;
ALTER TABLE "interview_links" ADD COLUMN "topics" TEXT;
ALTER TABLE "interview_links" ADD COLUMN "years_of_experience" INTEGER;

-- CreateTable
CREATE TABLE "question_bank" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topic" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "correct_answer" TEXT,
    "explanation" TEXT,
    "options" TEXT,
    "language" TEXT,
    "problem_statement" TEXT,
    "constraints" TEXT,
    "examples" TEXT,
    "starter_code" TEXT,
    "test_cases" TEXT,
    "hints" TEXT,
    "solution" TEXT,
    "time_complexity" TEXT,
    "space_complexity" TEXT,
    "companies" TEXT,
    "similar_to" TEXT,
    "tags" TEXT,
    "success_rate" REAL,
    "avg_time_taken" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "question_bank_topic_difficulty_idx" ON "question_bank"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "question_bank_question_type_category_idx" ON "question_bank"("question_type", "category");
