-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('candidate', 'interviewer');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "user_type" "UserType" NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "resume_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_links" (
    "id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "link_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expiry_date" TIMESTAMP(3),
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "interview_link_id" INTEGER,
    "candidate_name" TEXT NOT NULL,
    "candidate_email" TEXT NOT NULL,
    "candidate_phone" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "expected_answer" TEXT NOT NULL,
    "key_points" TEXT NOT NULL,
    "candidate_answer" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "candidate_answer" TEXT NOT NULL,
    "key_points_covered" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT NOT NULL,
    "needs_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_question" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_snapshots" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysis" TEXT,

    CONSTRAINT "code_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviewers" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "interviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theoretical_questions" (
    "id" SERIAL NOT NULL,
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
    "success_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theoretical_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_coding_questions" (
    "id" SERIAL NOT NULL,
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
    "success_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "starter_codes" TEXT,

    CONSTRAINT "machine_coding_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_evaluations" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "interview_link_id" INTEGER,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "full_conversation_history" TEXT NOT NULL,
    "theoretical_section" TEXT NOT NULL,
    "coding_section" TEXT NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "strengths" TEXT NOT NULL,
    "areas_for_improvement" TEXT NOT NULL,
    "overall_feedback" TEXT NOT NULL,
    "hint_request_count" INTEGER NOT NULL DEFAULT 0,
    "clarification_request_count" INTEGER NOT NULL DEFAULT 0,
    "follow_up_count" INTEGER NOT NULL DEFAULT 0,
    "average_time_per_question" DOUBLE PRECISION,
    "average_time_per_coding_problem" DOUBLE PRECISION,
    "llm_evaluation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER,
    "interview_link_id" INTEGER,
    "session_id" TEXT,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "interview_links_link_token_key" ON "interview_links"("link_token");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_session_id_key" ON "interviews"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_question_id_key" ON "evaluations"("question_id");

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

-- CreateIndex
CREATE UNIQUE INDEX "final_evaluations_interview_id_key" ON "final_evaluations"("interview_id");

-- CreateIndex
CREATE INDEX "SecurityEvent_session_id_idx" ON "SecurityEvent"("session_id");

-- CreateIndex
CREATE INDEX "SecurityEvent_interview_link_id_idx" ON "SecurityEvent"("interview_link_id");

-- AddForeignKey
ALTER TABLE "interview_links" ADD CONSTRAINT "interview_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "interviewers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interview_link_id_fkey" FOREIGN KEY ("interview_link_id") REFERENCES "interview_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_snapshots" ADD CONSTRAINT "code_snapshots_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_evaluations" ADD CONSTRAINT "final_evaluations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_interview_link_id_fkey" FOREIGN KEY ("interview_link_id") REFERENCES "interview_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
