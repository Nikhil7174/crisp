/*
  Warnings:

  - You are about to drop the `admin_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_bank` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "admin_users_username_key";

-- DropIndex
DROP INDEX "question_bank_question_type_category_idx";

-- DropIndex
DROP INDEX "question_bank_topic_difficulty_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "admin_users";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "question_bank";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "interviewers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "theoretical_questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topic" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expected_answer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "key_points" TEXT,
    "documentation" TEXT,
    "companies" TEXT,
    "tags" TEXT,
    "success_rate" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "machine_coding_questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "topic" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "problem_statement" TEXT NOT NULL,
    "constraints" TEXT,
    "examples" TEXT,
    "starter_code" TEXT,
    "test_cases" TEXT NOT NULL,
    "hints" TEXT,
    "solution" TEXT,
    "time_complexity" TEXT,
    "space_complexity" TEXT,
    "companies" TEXT,
    "similar_to" TEXT,
    "tags" TEXT,
    "success_rate" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_interview_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_by" INTEGER NOT NULL,
    "link_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expiry_date" DATETIME,
    "max_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "job_title" TEXT,
    "job_id" TEXT,
    "role" TEXT,
    "years_of_experience" INTEGER,
    "max_interview_questions" INTEGER,
    "max_machine_coding_questions" INTEGER,
    "topics" TEXT,
    "machine_questions" TEXT,
    "generated_questions" TEXT,
    "questions_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interview_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "interviewers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_interview_links" ("created_at", "created_by", "description", "expiry_date", "generated_questions", "id", "is_active", "job_id", "job_title", "link_token", "machine_questions", "max_attempts", "max_interview_questions", "max_machine_coding_questions", "questions_approved", "role", "title", "topics", "updated_at", "years_of_experience") SELECT "created_at", "created_by", "description", "expiry_date", "generated_questions", "id", "is_active", "job_id", "job_title", "link_token", "machine_questions", "max_attempts", "max_interview_questions", "max_machine_coding_questions", "questions_approved", "role", "title", "topics", "updated_at", "years_of_experience" FROM "interview_links";
DROP TABLE "interview_links";
ALTER TABLE "new_interview_links" RENAME TO "interview_links";
CREATE UNIQUE INDEX "interview_links_link_token_key" ON "interview_links"("link_token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "interviewers_email_key" ON "interviewers"("email");

-- CreateIndex
CREATE INDEX "theoretical_questions_topic_difficulty_idx" ON "theoretical_questions"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "theoretical_questions_category_idx" ON "theoretical_questions"("category");

-- CreateIndex
CREATE INDEX "machine_coding_questions_topic_difficulty_idx" ON "machine_coding_questions"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "machine_coding_questions_category_idx" ON "machine_coding_questions"("category");

-- CreateIndex
CREATE INDEX "machine_coding_questions_language_idx" ON "machine_coding_questions"("language");
