-- CreateTable
CREATE TABLE `RecurrenceTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskNumber` VARCHAR(191) NULL,
    `taskTitle` VARCHAR(191) NOT NULL,
    `raisedTo` INTEGER NOT NULL,
    `departmentId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `closeDate` DATETIME(3) NOT NULL,
    `taskBody` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `createdBy` INTEGER NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RecurrenceTask` ADD CONSTRAINT `RecurrenceTask_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurrenceTask` ADD CONSTRAINT `RecurrenceTask_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
