import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import UploadPanel from '../components/UploadPanel' // ✅ 新增 import

interface Tag {
  id: number
  name: string
}

interface Quiz {
  id: number
  question: string
  answer: string
  tags: { tag: Tag }[]
}

interface QuizSet {
  id: number
  title: string
  description?: string
  author: { id: number; username: string }
  quizzes: Quiz[]
}

export default function QuizSetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTags, setEditTags] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newTags, setNewTags] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUpload, setShowUpload] = useState(false) // ✅ 新增 state
  const [filterTag, setFilterTag] = useState('')

  const currentUserId = Number(localStorage.getItem('userId'))

  useEffect(() => {
    fetchQuizSet()
  }, [id])

  async function fetchQuizSet() {
    try {
      setLoading(true)
      const res = await api.get(`/quiz/${id}`)
      setQuizSet(res.data)
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  function toggleReveal(quizId: number) {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(quizId) ? next.delete(quizId) : next.add(quizId)
      return next
    })
  }

  function startEdit(quiz: Quiz) {
    setEditingId(quiz.id)
    setEditQuestion(quiz.question)
    setEditAnswer(quiz.answer)
    setEditTags(quiz.tags.map(t => t.tag.name).join(', '))
  }

  async function handleSaveEdit(quizId: number) {
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      await api.put(`/quiz/item/${quizId}`, {
        question: editQuestion,
        answer: editAnswer,
        tags
      })
      setEditingId(null)
      fetchQuizSet()
    } catch {
      setError('保存失败')
    }
  }

  async function handleDelete(quizId: number) {
    if (!confirm('确定删除这道题？')) return
    try {
      await api.delete(`/quiz/item/${quizId}`)
      fetchQuizSet()
    } catch {
      setError('删除失败')
    }
  }

  async function handleAddQuiz(e: React.FormEvent) {
    e.preventDefault()
    if (!newQuestion.trim() || !newAnswer.trim()) return
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(Boolean)
      await api.post('/quiz/item', {
        question: newQuestion,
        answer: newAnswer,
        quizSetId: Number(id),
        tags
      })
      setNewQuestion('')
      setNewAnswer('')
      setNewTags('')
      setShowAddForm(false)
      fetchQuizSet()
    } catch {
      setError('添加失败')
    }
  }

  if (loading) return <div style={{ padding: 32 }}>加载中...</div>
  if (error) return <div style={{ padding: 32, color: 'red' }}>{error}</div>
  if (!quizSet) return null

  const isAuthor = quizSet.author.id === currentUserId

  const allTags = Array.from(
    new Set(quizSet.quizzes.flatMap(q => q.tags.map(t => t.tag.name)))
  )

  const filteredQuizzes = filterTag
    ? quizSet.quizzes.filter(q => q.tags.some(t => t.tag.name === filterTag))
    : quizSet.quizzes

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>

      {/* 题库信息 */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/')} style={{ marginBottom: 12 }}>← 返回</button>
        <h1 style={{ margin: '0 0 4px' }}>{quizSet.title}</h1>
        {quizSet.description && (
          <p style={{ color: '#666', margin: '0 0 4px' }}>{quizSet.description}</p>
        )}
        <small style={{ color: '#999' }}>作者：{quizSet.author.username}</small>
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTag('')}
            style={{ fontWeight: !filterTag ? 'bold' : 'normal' }}
          >
            全部
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              style={{ fontWeight: filterTag === tag ? 'bold' : 'normal' }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ✅ 新增：作者操作按钮区（添加题目 + 上传文件） */}
      {isAuthor && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowAddForm(v => !v); setShowUpload(false) }}>
            {showAddForm ? '取消' : '+ 添加题目'}
          </button>
          <button onClick={() => { setShowUpload(v => !v); setShowAddForm(false) }}>
            {showUpload ? '取消上传' : '📄 上传文件'}
          </button>
        </div>
      )}

      {/* 新增题目表单 */}
      {showAddForm && (
        <form
          onSubmit={handleAddQuiz}
          style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}
        >
          <div style={{ marginBottom: 8 }}>
            <textarea
              placeholder="题目 *"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              rows={2}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <textarea
              placeholder="答案 *"
              value={newAnswer}
              onChange={e => setNewAnswer(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              rows={2}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="标签（逗号分隔，可选）"
              value={newTags}
              onChange={e => setNewTags(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit">确认添加</button>
        </form>
      )}

      {/* ✅ 新增：上传面板 */}
      {showUpload && (
        <div style={{ marginBottom: 24 }}>
          <UploadPanel
            quizSetId={Number(id)}
            onDone={() => {
              setShowUpload(false)
              fetchQuizSet()
            }}
          />
        </div>
      )}

      {/* 题目列表 */}
      {filteredQuizzes.length === 0 ? (
        <p>暂无题目</p>
      ) : (
        filteredQuizzes.map(quiz => (
          <div
            key={quiz.id}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}
          >
            {editingId === quiz.id ? (
              <div>
                <textarea
                  value={editQuestion}
                  onChange={e => setEditQuestion(e.target.value)}
                  style={{ width: '100%', padding: 8, marginBottom: 8 }}
                  rows={2}
                />
                <textarea
                  value={editAnswer}
                  onChange={e => setEditAnswer(e.target.value)}
                  style={{ width: '100%', padding: 8, marginBottom: 8 }}
                  rows={2}
                />
                <input
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="标签（逗号分隔）"
                  style={{ width: '100%', padding: 8, marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSaveEdit(quiz.id)}>保存</button>
                  <button onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 500 }}>{quiz.question}</p>
                {revealedIds.has(quiz.id) && (
                  <p style={{ margin: '0 0 8px', color: '#444' }}>{quiz.answer}</p>
                )}
                {quiz.tags.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {quiz.tags.map(t => (
                      <span
                        key={t.tag.id}
                        style={{
                          background: '#f0f0f0',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12
                        }}
                      >
                        {t.tag.name}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleReveal(quiz.id)}>
                    {revealedIds.has(quiz.id) ? '隐藏答案' : '显示答案'}
                  </button>
                  {isAuthor && (
                    <>
                      <button onClick={() => startEdit(quiz)}>编辑</button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        style={{ color: 'red' }}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
