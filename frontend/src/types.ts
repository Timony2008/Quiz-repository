export type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface Tag {
  id: number
  name: string
}

export interface Quiz {
  id: number
  question: string
  answer: string
  tags: { tag: Tag }[]
  difficulty?: Difficulty
}

export interface QuizSet {
  id: number
  title: string
  description?: string
  visibility: Visibility
  author: { id: number; username: string }
  quizzes: Quiz[]
}
