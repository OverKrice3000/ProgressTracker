-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "idle_hours_per_day" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
