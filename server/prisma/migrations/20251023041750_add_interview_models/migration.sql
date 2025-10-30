-- CreateTable
CREATE TABLE "interview_questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interview_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "expected_answer" TEXT NOT NULL,
    "key_points" TEXT NOT NULL,
    "candidate_answer" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interview_questions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interview_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "candidate_answer" TEXT NOT NULL,
    "key_points_covered" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "feedback" TEXT NOT NULL,
    "needs_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_question" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evaluations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "code_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interview_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysis" TEXT,
    CONSTRAINT "code_snapshots_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_question_id_key" ON "evaluations"("question_id");
