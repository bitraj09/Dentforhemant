CREATE TABLE `SiteVisitor` (
    `visitorHash` CHAR(64) NOT NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`visitorHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SiteVisitorDailyVisit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitorHash` CHAR(64) NOT NULL,
    `visitDay` CHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SiteVisitorDailyVisit_visitorHash_visitDay_key`(`visitorHash`, `visitDay`),
    INDEX `SiteVisitorDailyVisit_visitDay_idx`(`visitDay`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SiteVisitorDailyVisit`
ADD CONSTRAINT `SiteVisitorDailyVisit_visitorHash_fkey`
FOREIGN KEY (`visitorHash`) REFERENCES `SiteVisitor`(`visitorHash`)
ON DELETE CASCADE ON UPDATE CASCADE;
