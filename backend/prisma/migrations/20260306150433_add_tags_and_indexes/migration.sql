-- AlterTable
ALTER TABLE "SourceFile" ADD COLUMN "errorMsg" TEXT;

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TagOnQuiz" (
    "quizId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    PRIMARY KEY ("quizId", "tagId"),
    CONSTRAINT "TagOnQuiz_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TagOnQuiz_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isLabeled" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER NOT NULL,
    "quizSetId" INTEGER,
    "sourceFileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quiz_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quiz_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("answer", "authorId", "createdAt", "id", "question", "quizSetId", "sourceFileId") SELECT "answer", "authorId", "createdAt", "id", "question", "quizSetId", "sourceFileId" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE INDEX "Quiz_sourceFileId_idx" ON "Quiz"("sourceFileId");
CREATE INDEX "Quiz_isLabeled_idx" ON "Quiz"("isLabeled");
CREATE INDEX "Quiz_createdAt_idx" ON "Quiz"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
