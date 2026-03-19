import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import api, { updateVisibility, reorderQuizzes } from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'
import type { Tag, QuizFilterParams } from '../types'  // ← 从 types.ts 引入

export type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'
export type SortMode = 'custom' | 'difficulty_asc' | 'difficulty_desc' | 'time_desc' | 'time_asc'

export interface QuizSet {
  id: number
  title: string
  description?: string
  visibility: Visibility
  author: { id: number; username: string }
  quizzes: Quiz[]
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PRIVATE: '🔒 私有',
  PUBLIC: '🌐 公开只读',
  PUBLIC_EDIT: '✏️ 公开可编辑'
}

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'custom',          label: '⠿ 自定义顺序' },
  { value: 'difficulty_asc',  label: '⭐ 难度从低到高' },
  { value: 'difficulty_desc', label: '⭐ 难度从高到低' },
  { value: 'time_desc',       label: '🕐 最近更新优先' },
  { value: 'time_asc',        label: '🕐 最早更新优先' },
]

export function useQuizSet(id: string | undefined) {
  const navigate = useNavigate()
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('custom')
  const [filters, setFilters] = useState<QuizFilterParams>({})   // ← 替换 selectedTag
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [localQuizzes, setLocalQuizzes] = useState<Quiz[]>([])

  useEffect(() => { fetchQuizSet() }, [id])

  async function fetchQuizSet() {
    try {
      const res = await api.get(`/quiz/${id}`)
      setQuizSet(res.data)
      setLocalQuizzes(res.data.quizzes)
    } catch (err: any) {
      console.error('fetchQuizSet 失败:', err?.response?.status, err?.response?.data)
      navigate('/')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalQuizzes(prev => {
      const oldIndex = prev.findIndex(q => q.id === active.id)
      const newIndex = prev.findIndex(q => q.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  async function handleSaveReorder() {
    const items = localQuizzes.map((q, i) => ({ id: q.id, order: i }))
    await reorderQuizzes(items)
    setIsReorderMode(false)
    fetchQuizSet()
  }

  function enterReorderMode() {
    setIsReorderMode(true)
    setSortMode('custom')
  }

  function cancelReorderMode() {
    setIsReorderMode(false)
    if (quizSet) setLocalQuizzes(quizSet.quizzes)
  }

  async function handleVisibilityChange(v: Visibility) {
    await updateVisibility(quizSet!.id, v)
    setQuizSet(prev => prev ? { ...prev, visibility: v } : prev)
  }

  // ── 排序 ─────────────────────────────────────────────────────
  const baseQuizzes = isReorderMode ? localQuizzes : (quizSet?.quizzes ?? [])

  const sortedQuizzes = isReorderMode
    ? baseQuizzes
    : [...baseQuizzes].sort((a, b) => {
        switch (sortMode) {
          case 'difficulty_asc':  return toDiffNum(a.difficulty) - toDiffNum(b.difficulty)
          case 'difficulty_desc': return toDiffNum(b.difficulty) - toDiffNum(a.difficulty)
          case 'time_desc': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          case 'time_asc':  return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          default: return (a.order ?? 0) - (b.order ?? 0)
        }
      })

  // ── 多维度交叉过滤 ────────────────────────────────────────────
  const filteredQuizzes = sortedQuizzes.filter(q => {
    const tagNames = q.tags.map(t => t.tag.name)
    if (filters.knowledge && !tagNames.includes(filters.knowledge)) return false
    if (filters.method    && !tagNames.includes(filters.method))    return false
    if (filters.source    && !tagNames.includes(filters.source))    return false
    if (filters.context   && !tagNames.includes(filters.context))   return false
    if (filters.difficulty && q.difficulty !== filters.difficulty)  return false
    return true
  })

  // ── 收集所有标签（保留 dimension）────────────────────────────
  const allTagObjects: Tag[] = Array.from(
    new Map(
      (quizSet?.quizzes ?? [])
        .flatMap(q => q.tags.map(t => t.tag))
        .map(t => [t.id, t])
    ).values()
  )

  return {
    quizSet, setQuizSet,
    sortMode, setSortMode,
    filters, setFilters,          // ← 新
    isReorderMode,
    filteredQuizzes,
    allTagObjects,
    handleDragEnd,
    handleSaveReorder,
    enterReorderMode,
    cancelReorderMode,
    handleVisibilityChange,
    fetchQuizSet,
  }
}
