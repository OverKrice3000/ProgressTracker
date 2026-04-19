/*
  Warnings:

  - You are about to drop the column `start_time` on the `current_sessions` table. All the data in the column will be lost.
  - Added the required column `start_time_ms` to the `current_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "current_sessions" DROP COLUMN "start_time",
ADD COLUMN     "start_time_ms" BIGINT NOT NULL;
