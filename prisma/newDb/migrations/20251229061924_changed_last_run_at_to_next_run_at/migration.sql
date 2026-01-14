/*
  Warnings:

  - You are about to drop the column `lastRunAt` on the `RecurrenceTask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `RecurrenceTask` DROP COLUMN `lastRunAt`,
    ADD COLUMN `nextRunAt` DATETIME(3) NULL;
