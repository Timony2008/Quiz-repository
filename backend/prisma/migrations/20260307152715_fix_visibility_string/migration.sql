/*
  Warnings:

  - You are about to drop the `SourceFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TagOnQuiz` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `sourceFileId` on the `Quiz` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SourceFile";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TagOnQuiz";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "QuizTag" (
    "quizId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    PRIMARY KEY ("quizId", "tagId"),
    CONSTRAINT "QuizTag_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "quizSetId" INTEGER NOT NULL,
    CONSTRAINT "Quiz_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("answer", "id", "question", "quizSetId") SELECT "answer", "id", "question", "quizSetId" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE TABLE "new_QuizSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "authorId" INTEGER NOT NULL,
    CONSTRAINT "QuizSet_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuizSet" ("authorId", "description", "id", "title") SELECT "authorId", "description", "id", "title" FROM "QuizSet";
DROP TABLE "QuizSet";
ALTER TABLE "new_QuizSet" RENAME TO "QuizSet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
