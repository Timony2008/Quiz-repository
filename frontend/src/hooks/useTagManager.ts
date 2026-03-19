import { useState } from 'react'
import api from '../api'
import type { Tag, QuizFilterParams } from '../types'

export function useTagManager(
  onSuccess: () => void,
  filters: QuizFilterParams,
  setFilters: (f: QuizFilterParams) => void
) {
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagDimension, setNewTagDimension] = useState('KNOWLEDGE')
  const [isTagMode, setIsTagMode] = useState(false)
  const [pendingTagId, setPendingTagId] = useState<number | null>(null)

  function exitTagMode() {
    setIsTagMode(false)
    setPendingTagId(null)
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    try {
      const res = await api.post('/tag', {
        name: newTagName.trim(),
        dimension: newTagDimension,
      })
      const createdTag: Tag = res.data
      setNewTagName('')
      setNewTagDimension('KNOWLEDGE')
      setShowNewTagInput(false)
      setIsTagMode(true)
      setPendingTagId(createdTag.id)
      onSuccess()
    } catch (err: any) {
      if (err?.response?.status === 409) alert('标签已存在')
    }
  }

  async function handleDeleteTag(tagId: number, tagName: string) {
    if (!confirm(`删除标签「${tagName}」？\n只删标签，不删题目。`)) return
    await api.delete(`/tag/${tagId}`)
    // 清除该标签对应的筛选维度
    const updated = { ...filters }
    const keys: (keyof QuizFilterParams)[] = ['knowledge', 'method', 'source', 'context']
    for (const k of keys) {
      if (updated[k] === tagName) delete updated[k]
    }
    setFilters(updated)
    onSuccess()
  }

  async function handleAttachTag(selectedIds: Set<number>) {
    if (!pendingTagId || selectedIds.size === 0) { exitTagMode(); return }
    await api.post(`/tag/${pendingTagId}/attach`, { quizIds: Array.from(selectedIds) })
    exitTagMode()
    onSuccess()
  }

  return {
    showNewTagInput, setShowNewTagInput,
    newTagName, setNewTagName,
    newTagDimension, setNewTagDimension,
    isTagMode, setIsTagMode,
    pendingTagId,
    exitTagMode,
    handleCreateTag,
    handleDeleteTag,
    handleAttachTag,
  }
}
