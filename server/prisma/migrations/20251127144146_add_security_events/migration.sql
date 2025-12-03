-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "security_consent" TEXT;

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interview_link_id" INTEGER,
    "interview_id" INTEGER,
    "session_id" TEXT,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityEvent_interview_link_id_fkey" FOREIGN KEY ("interview_link_id") REFERENCES "interview_links" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SecurityEvent_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SecurityEvent_session_id_idx" ON "SecurityEvent"("session_id");

-- CreateIndex
CREATE INDEX "SecurityEvent_interview_link_id_idx" ON "SecurityEvent"("interview_link_id");
