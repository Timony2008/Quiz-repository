/*
  Warnings:

  - You are about to alter the column `difficulty` on the `Quiz` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `updatedAt` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "quizSetId" INTEGER NOT NULL,
    "difficulty" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFileId" INTEGER,
    CONSTRAINT "Quiz_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quiz_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("answer", "difficulty", "id", "order", "question", "quizSetId", "sourceFileId", "updatedAt") 
SELECT "answer", "difficulty", "id", "order", "question", "quizSetId", "sourceFileId", CURRENT_TIMESTAMP FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
