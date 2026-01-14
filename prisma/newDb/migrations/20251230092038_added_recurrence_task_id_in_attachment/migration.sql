-- AlterTable
ALTER TABLE `Attachment` ADD COLUMN `recurrenceTaskId` INTEGER NULL,
    MODIFY `taskId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_recurrenceTaskId_fkey` FOREIGN KEY (`recurrenceTaskId`) REFERENCES `RecurrenceTask`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
