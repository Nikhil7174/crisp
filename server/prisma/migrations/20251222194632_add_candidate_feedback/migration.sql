-- CreateTable
CREATE TABLE "candidate_feedback" (
    "id" SERIAL NOT NULL,
    "interview_id" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "overall_experience" TEXT,
    "technical_questions_quality" TEXT,
    "interview_platform_rating" INTEGER,
    "suggestions" TEXT,
    "would_recommend" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_feedback_interview_id_key" ON "candidate_feedback"("interview_id");

-- CreateIndex
CREATE INDEX "candidate_feedback_session_id_idx" ON "candidate_feedback"("session_id");

-- AddForeignKey
ALTER TABLE "candidate_feedback" ADD CONSTRAINT "candidate_feedback_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
