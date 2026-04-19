-- AlterTable
ALTER TABLE "progress_logs" ADD COLUMN "applied_tracker_metadata" JSONB;

-- Best-effort backfill: non-terminal logs get next log's pre-state (snapshot.trackerMetadata); terminal log gets current task metadata.
UPDATE "progress_logs" pl
SET "applied_tracker_metadata" = (
  SELECT pl2."snapshot"->'trackerMetadata'
  FROM "progress_logs" pl2
  WHERE pl2."task_id" = pl."task_id"
    AND (
      pl2."logged_date" > pl."logged_date"
      OR (
        pl2."logged_date" = pl."logged_date"
        AND (
          pl2."created_at" > pl."created_at"
          OR (pl2."created_at" = pl."created_at" AND pl2."id" > pl."id")
        )
      )
    )
  ORDER BY pl2."logged_date" ASC, pl2."created_at" ASC, pl2."id" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "progress_logs" pl2
  WHERE pl2."task_id" = pl."task_id"
    AND (
      pl2."logged_date" > pl."logged_date"
      OR (
        pl2."logged_date" = pl."logged_date"
        AND (
          pl2."created_at" > pl."created_at"
          OR (pl2."created_at" = pl."created_at" AND pl2."id" > pl."id")
        )
      )
    )
);

UPDATE "progress_logs" pl
SET "applied_tracker_metadata" = t."tracker_metadata"
FROM "tasks" t
WHERE pl."task_id" = t."id"
  AND pl."applied_tracker_metadata" IS NULL;
