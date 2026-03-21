import { useState } from 'react'
import api from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'

export function useQuizEdit(quizSetId: string | undefined, onSuccess: () => void) {
  // ── 添加表单 ──────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [note, setNote] = useState('') // ✅ 新增
  const [tagInput, setTagInput] = useState('')
  const [difficulty, setDifficulty] = useState('')

  // ── 编辑 ──────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editNote, setEditNote] = useState('') // ✅ 新增
  const [editTagInput, setEditTagInput] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('')
  const [editTagIds, setEditTagIds] = useState<number[]>([])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return

    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    const diffVal = difficulty.trim() !== '' ? parseFloat(difficulty) : undefined
    if (diffVal !== undefined && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }

    await api.post(`/quiz/${quizSetId}/items`, {
      question,
      answer,
      note: note.trim() || null, // ✅ 新增
      tags,
      ...(diffVal !== undefined ? { difficulty: diffVal } : {})
    })

    setQuestion('')
    setAnswer('')
    setNote('') // ✅ 新增
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
    setEditQuestion(q.question)
    setEditAnswer(q.answer)
    setEditNote((q as any).note ?? '') // ✅ 新增（若你的 Quiz 类型已加 note，可直接 q.note）
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

    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion,
      answer: editAnswer,
      note: editNote.trim() || null, // ✅ 新增
      tagIds: editTagIds,
      difficulty: diffVal,
    })

    setEditingId(null)
    setEditTagIds([])
    setEditNote('') // ✅ 新增
    onSuccess()
  }

  return {
    showAddForm, setShowAddForm,
    question, setQuestion,
    answer, setAnswer,
    note, setNote, // ✅ 新增
    tagInput, setTagInput,
    difficulty, setDifficulty,
    editingId, setEditingId,
    editQuestion, setEditQuestion,
    editAnswer, setEditAnswer,
    editNote, setEditNote, // ✅ 新增
    editTagInput, setEditTagInput,
    editDifficulty, setEditDifficulty,
    editTagIds, setEditTagIds,
    handleAdd,
    handleDelete,
    startEdit,
    handleEditSave,
  }
}
