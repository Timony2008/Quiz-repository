import { useState } from 'react'
import api from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'

export function useQuizEdit(quizSetId: string | undefined, onSuccess: () => void) {
  // ── 添加表单 ──────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [difficulty, setDifficulty] = useState('')

  // ── 编辑 ──────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTagInput, setEditTagInput] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('')

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
      question, answer, tags,
      ...(diffVal !== undefined ? { difficulty: diffVal } : {})
    })
    setQuestion(''); setAnswer(''); setTagInput(''); setDifficulty('')
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
    setEditTagInput(q.tags.map(t => t.tag.name).join(', '))
    setEditDifficulty(q.difficulty != null ? String(toDiffNum(q.difficulty)) : '')
  }

  async function handleEditSave(quizId: number) {
    const tags = editTagInput.split(',').map(t => t.trim()).filter(Boolean)
    const diffVal = editDifficulty.trim() !== '' ? parseFloat(editDifficulty) : null
    if (diffVal !== null && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }
    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion, answer: editAnswer, tags, difficulty: diffVal
    })
    setEditingId(null)
    onSuccess()
  }

  return {
    showAddForm, setShowAddForm,
    question, setQuestion,
    answer, setAnswer,
    tagInput, setTagInput,
    difficulty, setDifficulty,
    editingId, setEditingId,
    editQuestion, setEditQuestion,
    editAnswer, setEditAnswer,
    editTagInput, setEditTagInput,
    editDifficulty, setEditDifficulty,
    handleAdd,
    handleDelete,
    startEdit,
    handleEditSave,
  }
}
