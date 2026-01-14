-- AlterTable
ALTER TABLE `RecurrenceTask` ADD COLUMN `isScheduleActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `lastRunAt` DATETIME(3) NULL;
