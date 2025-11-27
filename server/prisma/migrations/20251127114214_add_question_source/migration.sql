-- AlterTable
ALTER TABLE "machine_coding_questions" ADD COLUMN "starter_codes" TEXT;

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
    "question_source" TEXT DEFAULT 'auto',
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
