-- CreateTable
CREATE TABLE "final_evaluations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interview_id" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "interview_link_id" INTEGER,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "full_conversation_history" TEXT NOT NULL,
    "theoretical_section" TEXT NOT NULL,
    "coding_section" TEXT NOT NULL,
    "total_score" REAL NOT NULL,
    "strengths" TEXT NOT NULL,
    "areas_for_improvement" TEXT NOT NULL,
    "overall_feedback" TEXT NOT NULL,
    "hint_request_count" INTEGER NOT NULL DEFAULT 0,
    "clarification_request_count" INTEGER NOT NULL DEFAULT 0,
    "follow_up_count" INTEGER NOT NULL DEFAULT 0,
    "average_time_per_question" REAL,
    "average_time_per_coding_problem" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "final_evaluations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "final_evaluations_interview_id_key" ON "final_evaluations"("interview_id");


