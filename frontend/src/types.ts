export type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

export type TagMatchMode = 'OR' | 'AND'
export type TagViewMode = 'ALL' | 'SELECTED' | 'GROUPED'

// ── Tag ──────────────────────────────────────────────────────
export interface Tag {
  id: number
  name: string
  dimension: TagDimension
  isGlobal?: boolean
  parentId?: number | null
  aliases?: string[]
  children?: Tag[]
}

export interface QuizFilterParams {
  knowledge?: string
  method?: string
  source?: string
  context?: string
  difficulty?: Difficulty
  keyword?: string

  // 兼容你现有逻辑
  tagId?: number
  tagIds?: number[]

  // 新增
  tagMatchMode?: TagMatchMode   // OR / AND
  tagViewMode?: TagViewMode     // ALL / SELECTED / GROUPED
}

// AI 推荐标签（半透明展示用）
export interface AITagSuggestion {
  tags: {
    knowledge: string[]
    method: string[]
    source: string | null
    context: string[]
  }
  confidence: number          // 0.0 ~ 1.0
}

// src/types.ts — Quiz 接口
export interface Quiz {
  id: number
  question: string
  answer: string
  difficulty?: Difficulty        // 'EASY' | 'MEDIUM' | 'HARD' | undefined
  tags: { tag: Tag }[]
  order: number                  // ← 补上
  updatedAt: string              // ← 补上
  aiSuggestion?: AITagSuggestion
}

// ── QuizSet ──────────────────────────────────────────────────
export interface QuizSet {
  id: number
  title: string
  description?: string
  visibility: Visibility
  author: { id: number; username: string }
  quizzes: Quiz[]
}

