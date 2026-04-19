-- AlterTable
ALTER TABLE "progress_logs" ADD COLUMN "logged_date" DATE;

UPDATE "progress_logs" SET "logged_date" = CAST("timestamp" AS date);

ALTER TABLE "progress_logs" ALTER COLUMN "logged_date" SET NOT NULL;

CREATE INDEX "progress_logs_user_id_logged_date_idx" ON "progress_logs"("user_id", "logged_date");
