// ── 基础枚举 ─────────────────────────────────────────────────
export type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

// ── Tag ──────────────────────────────────────────────────────
export interface Tag {
  id: number
  name: string
  dimension: TagDimension
  isGlobal?: boolean          // ← 新增：全局标签 true，本库私有 false/undefined
  parentId?: number | null
  aliases?: string[]          // 别名列表，用于搜索匹配
  children?: Tag[]            // 树形结构（KNOWLEDGE 维度使用）
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

// ── 筛选参数（Dashboard 多维度交叉查询用）────────────────────
export interface QuizFilterParams {
  knowledge?: string
  method?: string
  source?: string
  context?: string
  difficulty?: Difficulty
  keyword?: string
  tagId?: number
}
