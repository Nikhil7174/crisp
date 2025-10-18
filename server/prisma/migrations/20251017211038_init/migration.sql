-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "user_type" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "resume_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "interview_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_by" INTEGER NOT NULL,
    "link_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expiry_date" DATETIME,
    "max_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interview_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "interview_link_id" INTEGER,
    "candidate_name" TEXT NOT NULL,
    "candidate_email" TEXT NOT NULL,
    "candidate_phone" TEXT,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "duration" INTEGER,
    "score" INTEGER,
    "total_questions" INTEGER,
    "correct_answers" INTEGER,
    "time_spent" INTEGER,
    "strengths" TEXT,
    "areas_for_improvement" TEXT,
    "overall_feedback" TEXT,
    "detailed_answers" TEXT,
    "question_analysis" TEXT,
    "is_mock_interview" BOOLEAN NOT NULL DEFAULT false,
    "cheating_detected" BOOLEAN NOT NULL DEFAULT false,
    "cheating_incidents" TEXT,
    "security_agent_connected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "interviews_interview_link_id_fkey" FOREIGN KEY ("interview_link_id") REFERENCES "interview_links" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "interview_links_link_token_key" ON "interview_links"("link_token");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_session_id_key" ON "interviews"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");
