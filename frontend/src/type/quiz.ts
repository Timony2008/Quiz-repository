export interface Tag { id: number; name: string }

export interface Quiz {
  id: number
  question: string
  answer: string
  tags: { tag: Tag }[]
  difficulty?: number | string | null
  order: number
  updatedAt: string
}