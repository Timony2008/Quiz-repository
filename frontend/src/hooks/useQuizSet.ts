import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import api, { updateVisibility, reorderQuizzes } from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'
import type { Tag, QuizFilterParams } from '../types'

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
  const [filters, setFilters] = useState<QuizFilterParams>({
    tagMatchMode: 'OR',
    tagViewMode: 'GROUPED',
  })
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [localQuizzes, setLocalQuizzes] = useState<Quiz[]>([])
  const [globalTagObjects, setGlobalTagObjects] = useState<Tag[]>([])

  useEffect(() => { fetchQuizSet() }, [id])
  useEffect(() => { fetchGlobalTags() }, [])

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

  async function fetchGlobalTags() {
    try {
      const res = await api.get('/tag?scope=global')
      setGlobalTagObjects(res.data)
    } catch (err) {
      console.error('fetchGlobalTags 失败:', err)
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

  const selectedTagIds = filters.tagIds
  const matchMode = filters.tagMatchMode ?? 'OR'

  const filteredQuizzes = sortedQuizzes.filter(q => {
    if (selectedTagIds && selectedTagIds.length > 0) {
      const quizTagIds = q.tags.map(t => t.tag.id)
      const hit = matchMode === 'AND'
        ? selectedTagIds.every(id => quizTagIds.includes(id))
        : selectedTagIds.some(id => quizTagIds.includes(id))
      if (!hit) return false
    }
    if (filters.difficulty && q.difficulty !== filters.difficulty) return false
    return true
  })

  const allTagObjects = Array.from(
    new Map(
      [
        ...(quizSet?.quizzes ?? []).flatMap(q => q.tags.map(t => t.tag)),
        ...globalTagObjects,
      ].map(t => [t.id, t])
    ).values()
  )

  return {
    quizSet, setQuizSet,
    sortMode, setSortMode,
    filters, setFilters,
    isReorderMode,
    filteredQuizzes,
    allTagObjects,
    globalTagObjects,
    handleDragEnd,
    handleSaveReorder,
    enterReorderMode,
    cancelReorderMode,
    handleVisibilityChange,
    fetchQuizSet,
  }
}
