import { useState } from 'react'
import api from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'

export function useQuizEdit(quizSetId: string | undefined, onSuccess: () => void) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [note, setNote] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [difficulty, setDifficulty] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editTagInput, setEditTagInput] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('')
  const [editTagIds, setEditTagIds] = useState<number[]>([])

  function parseTagInput(input: string): string[] {
    return [...new Set(input.split(',').map(t => t.trim()).filter(Boolean))]
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()

    if (!question.trim()) return

    if (!quizSetId) {
      alert('缺少 quizSetId')
      return
    }

    const tags = parseTagInput(tagInput)
    const diffVal = difficulty.trim() !== '' ? parseFloat(difficulty) : undefined
    if (diffVal !== undefined && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }

    // 关键：不做 tag-check，不自动创建，直接交给后端按已有标签解析
    // 若存在未创建标签，后端会返回 400 + missingNames
    try {
      await api.post(`/quiz/${quizSetId}/items`, {
        question: question.trim(),
        answer: answer.trim(),
        note: note.trim() || null,
        ...(tags.length > 0 ? { tags } : {}),
        ...(diffVal !== undefined ? { difficulty: diffVal } : {}),
      })
    } catch (err: any) {
      const missingNames = err?.response?.data?.missingNames
      if (Array.isArray(missingNames) && missingNames.length > 0) {
        alert(`以下标签不存在，未保存：${missingNames.join('、')}\n请先在标签管理中手动创建。`)
        return
      }
      throw err
    }

    setQuestion('')
    setAnswer('')
    setNote('')
    setTagInput('')
    setDifficulty('')
    setShowAddForm(false)
    onSuccess()
  }

  async function handleDelete(quizId: number) {
    if (!confirm('确定删除这道题？')) return
    await api.delete(`/quiz/item/${quizId}`)
    onSuccess()
  }

  function startEdit(q: Quiz) {
    setEditingId(q.id)
    setEditQuestion(q.question ?? '')
    setEditAnswer(q.answer ?? '')
    setEditNote((q as any).note ?? '')
    setEditTagInput(q.tags.map(t => t.tag.name).join(', '))
    setEditDifficulty(q.difficulty != null ? String(toDiffNum(q.difficulty)) : '')
    setEditTagIds(q.tags.map(t => t.tag.id))
  }

  async function handleEditSave(quizId: number) {
    const diffVal = editDifficulty.trim() !== '' ? parseFloat(editDifficulty) : null
    if (diffVal !== null && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }

    // 编辑保持你原逻辑：传 tagIds（来自已有标签）
    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion.trim(),
      answer: editAnswer.trim(),
      note: editNote.trim() || null,
      tagIds: editTagIds,
      difficulty: diffVal,
    })

    setEditingId(null)
    setEditTagIds([])
    setEditNote('')
    onSuccess()
  }

  return {
    showAddForm, setShowAddForm,
    question, setQuestion,
    answer, setAnswer,
    note, setNote,
    tagInput, setTagInput,
    difficulty, setDifficulty,

    editingId, setEditingId,
    editQuestion, setEditQuestion,
    editAnswer, setEditAnswer,
    editNote, setEditNote,
    editTagInput, setEditTagInput,
    editDifficulty, setEditDifficulty,
    editTagIds, setEditTagIds,

    handleAdd,
    handleDelete,
    startEdit,
    handleEditSave,
  }
}
