import { useState } from 'react'
import api from '../api'
import type { Quiz } from '../type/quiz'

export function useSelectMode(filteredQuizzes: Quiz[], onSuccess: () => void) {
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredQuizzes.length)
      setSelectedIds(new Set())
    else
      setSelectedIds(new Set(filteredQuizzes.map(q => q.id)))
  }

  function exitSelectMode() {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleBatchDelete() {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 道题？此操作不可撤销。`)) return
    await api.delete('/quiz/batch', { data: { ids: Array.from(selectedIds) } })
    exitSelectMode()
    onSuccess()
  }

  return {
    isSelectMode, setIsSelectMode,
    selectedIds, setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    exitSelectMode,
    handleBatchDelete,
  }
}
