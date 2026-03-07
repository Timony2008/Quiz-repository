-- CreateTable
CREATE TABLE "TagOnQuizSet" (
    "quizSetId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    PRIMARY KEY ("quizSetId", "tagId"),
    CONSTRAINT "TagOnQuizSet_quizSetId_fkey" FOREIGN KEY ("quizSetId") REFERENCES "QuizSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TagOnQuizSet_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
