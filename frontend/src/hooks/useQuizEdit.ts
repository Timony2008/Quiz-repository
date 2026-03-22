import { useState } from 'react'
import api from '../api'
import { toDiffNum } from '../components/DifficultyBadge'
import type { Quiz } from '../type/quiz'

type TagCheckResp = {
  existingTagIds: number[]
  missingNames: string[]
}

type CreateTagResp = {
  id: number
  name: string
}

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

    // 只强制题目
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

    const checkRes = await api.post<TagCheckResp>(`/quiz/${quizSetId}/items/tag-check`, { tags })
    const { existingTagIds, missingNames } = checkRes.data
    let finalTagIds = [...existingTagIds]

    if (missingNames.length > 0) {
      const ok = confirm(`检测到新标签：${missingNames.join('、')}\n是否创建后再保存？`)
      if (!ok) return

      for (const name of missingNames) {
        const created = await api.post<CreateTagResp>('/tag', {
          name,
          dimension: 'CONTEXT',
          quizSetId: Number(quizSetId),
          isGlobal: false,
          confirmCreate: true,
        })
        finalTagIds.push(created.data.id)
      }
    }

    finalTagIds = [...new Set(finalTagIds)]

    await api.post(`/quiz/${quizSetId}/items`, {
      question: question.trim(),
      answer: answer.trim(), // 可空
      note: note.trim() || null,
      tagIds: finalTagIds,
      ...(diffVal !== undefined ? { difficulty: diffVal } : {}),
    })

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

    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion.trim(),
      answer: editAnswer.trim(), // 可空
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
