import { useState } from 'react'
import api from '../api'
import type { Tag, QuizFilterParams } from '../types'

export function useTagManager(
  onSuccess: () => void,
  filters: QuizFilterParams,
  setFilters: (f: QuizFilterParams) => void,
  quizSetId?: number
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

  // attachToQuizId 有值 → 编辑态直接打标，不进 tagMode
  // attachToQuizId 无值 → FilterBar 新建，进 tagMode 让用户批量选题
  async function handleCreateTag(name: string, attachToQuizId?: number) {
    if (!name.trim()) return
    try {
      const res = await api.post('/tag', {
        name: name.trim(),
        dimension: 'KNOWLEDGE',
        quizSetId: quizSetId ?? null,
      })
      const createdTag: Tag = res.data

      if (attachToQuizId !== undefined) {
        await api.post(`/tag/${createdTag.id}/attach`, {
          quizIds: [attachToQuizId],
        })
        onSuccess()
      } else {
        setIsTagMode(true)
        setPendingTagId(createdTag.id)
        onSuccess()
      }
    } catch (err: any) {
      if (err?.response?.status === 409) alert('标签已存在')
    }
  }

  async function handleDeleteTag(tagId: number, tagName: string) {
    if (!confirm(`删除标签「${tagName}」？\n只删标签，不删题目。`)) return
    await api.delete(`/tag/${tagId}`)

    // 如果当前筛选包含这个标签，删除它
    const prevTagIds = (((filters as any).tagIds ?? []) as number[])
    const prevTagId = (filters as any).tagId as number | undefined

    if (prevTagIds.includes(tagId)) {
      const nextTagIds = prevTagIds.filter(id => id !== tagId)
      setFilters({ ...filters, tagIds: nextTagIds, tagId: undefined } as any)
    } else if (prevTagId === tagId) {
      setFilters({ ...filters, tagId: undefined } as any)
    } else {
      setFilters({ ...filters })
    }

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
