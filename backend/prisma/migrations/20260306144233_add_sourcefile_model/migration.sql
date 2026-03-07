/*
  Warnings:

  - You are about to drop the column `description` on the `Quiz` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Quiz` table. All the data in the column will be lost.
  - Added the required column `answer` to the `Quiz` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SourceFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "quizCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "sourceFileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quiz_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("authorId", "createdAt", "id") SELECT "authorId", "createdAt", "id" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
