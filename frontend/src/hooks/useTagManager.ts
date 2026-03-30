import { useState } from 'react'
import api from '../api'
import type { Tag, QuizFilterParams } from '../types'

type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'

export function useTagManager(
  onSuccess: () => void,
  filters: QuizFilterParams,
  setFilters: (f: QuizFilterParams) => void,
  quizSetId?: number
) {
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagDimension, setNewTagDimension] = useState<TagDimension>('KNOWLEDGE')
  const [isTagMode, setIsTagMode] = useState(false)
  const [pendingTagId, setPendingTagId] = useState<number | null>(null)

  function exitTagMode() {
    setIsTagMode(false)
    setPendingTagId(null)
  }

  // 只进入批量打标签模式（不预设标签）
  function enterTagMode() {
    setIsTagMode(true)
  }

  // 进入批量打标签并指定已有标签
  function startTagModeWithTag(tagId: number) {
    setIsTagMode(true)
    setPendingTagId(tagId)
  }

  async function handleCreateTag(name: string, attachToQuizId?: number) {
    const trimmed = name.trim()
    if (!trimmed) return

    try {
      const res = await api.post('/tag', {
        name: trimmed,
        dimension: newTagDimension || 'KNOWLEDGE',
        quizSetId: quizSetId ?? null,
        isGlobal: false,       // 后端普通流程不允许 true
        confirmCreate: true,   // 关键：后端必填
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

      // 可选：创建成功后清空输入
      setNewTagName('')
      setShowNewTagInput(false)
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.error

      if (status === 409) {
        alert(msg || '标签已存在')
      } else if (status === 400) {
        alert(msg || '请求参数错误（400）')
      } else if (status === 403) {
        alert(msg || '无权限创建该标签（403）')
      } else {
        alert(msg || '创建标签失败，请稍后重试')
      }
    }
  }

  async function handleDeleteTag(tagId: number, tagName: string) {
    if (!confirm(`删除标签「${tagName}」？\n只删标签，不删题目。`)) return
    await api.delete(`/tag/${tagId}`)

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
    if (!pendingTagId) {
      alert('请先选择一个标签')
      return
    }
    if (selectedIds.size === 0) {
      alert('请先选择至少一道题')
      return
    }

    await api.post(`/tag/${pendingTagId}/attach`, { quizIds: Array.from(selectedIds) })
    exitTagMode()
    onSuccess()
  }

  return {
    showNewTagInput, setShowNewTagInput,
    newTagName, setNewTagName,
    newTagDimension, setNewTagDimension,

    isTagMode, setIsTagMode,
    pendingTagId, setPendingTagId,
    enterTagMode,
    startTagModeWithTag,
    exitTagMode,

    handleCreateTag,
    handleDeleteTag,
    handleAttachTag,
  }
}
