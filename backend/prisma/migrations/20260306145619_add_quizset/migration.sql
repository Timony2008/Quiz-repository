-- CreateTable
CREATE TABLE "QuizSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizSet_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "quizSetId" INTEGER,
    "sourceFileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quiz_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quiz_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("answer", "authorId", "createdAt", "id", "question", "sourceFileId") SELECT "answer", "authorId", "createdAt", "id", "question", "sourceFileId" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
