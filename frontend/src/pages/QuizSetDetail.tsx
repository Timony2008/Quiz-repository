import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

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
  tags: { tag: Tag }[]
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
  const [saving, setSaving] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  const fetchQuizSet = () => {
    setLoading(true)
    api.get(`/quizzes/${id}`)
      .then(res => setQuizSet(res.data))
      .catch(() => setError('获取题库失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchQuizSet() }, [id])

  const toggleReveal = (quizId: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(quizId) ? next.delete(quizId) : next.add(quizId)
      return next
    })
  }

  const revealAll = () => {
    if (!quizSet) return
    setRevealedIds(new Set(filteredQuizzes.map(q => q.id)))
  }

  const hideAll = () => setRevealedIds(new Set())

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('确定删除这道题？')) return
    try {
      await api.delete(`/quizzes/item/${quizId}`)
      fetchQuizSet()
    } catch {
      setError('删除失败')
    }
  }

  const startEdit = (quiz: Quiz) => {
    setEditingId(quiz.id)
    setEditQuestion(quiz.question)
    setEditAnswer(quiz.answer)
    setEditTags(quiz.tags.map(t => t.tag.name).join(', '))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuestion('')
    setEditAnswer('')
    setEditTags('')
  }

  const handleSaveEdit = async (quizId: number) => {
    setSaving(true)
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      await api.put(`/quizzes/item/${quizId}`, {
        question: editQuestion,
        answer: editAnswer,
        tags
      })
      cancelEdit()
      fetchQuizSet()
    } catch {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(tagName) ? next.delete(tagName) : next.add(tagName)
      return next
    })
  }

  if (loading) return <p style={{ padding: 40, color: '#555' }}>加载中...</p>
  if (error)   return <p style={{ padding: 40, color: '#e53935' }}>{error}</p>
  if (!quizSet) return null

  // 聚合所有题目的标签，去重
  const allTags = Array.from(
    new Map(
      quizSet.quizzes
        .flatMap(q => q.tags.map(t => t.tag))
        .map(tag => [tag.id, tag])
    ).values()
  )

  // 过滤后的题目
  const filteredQuizzes = selectedTags.size === 0
    ? quizSet.quizzes
    : quizSet.quizzes.filter(q =>
        q.tags.some(t => selectedTags.has(t.tag.name))
      )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f6fa',
      fontFamily: 'system-ui, sans-serif',
      color: '#222'
    }}>
      {/* ── 顶栏 ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: '1px solid #ccc', borderRadius: 6,
          padding: '5px 14px', cursor: 'pointer', fontSize: 13, color: '#555'
        }}>
          ← 返回题库列表
        </button>
      </div>

      {/* ── 主体 ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

        {/* 题库信息 */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '20px 24px',
          marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          border: '1px solid #e8eaf6'
        }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, color: '#1a1a1a' }}>{quizSet.title}</h2>
          {quizSet.description && (
            <p style={{ color: '#888', margin: '4px 0', fontSize: 14 }}>{quizSet.description}</p>
          )}
          <p style={{ color: '#aaa', fontSize: 13, margin: '4px 0 0' }}>
            共 {quizSet.quizzes.length} 道题 · 作者：{quizSet.author.username}
          </p>
        </div>

        {/* 标签筛选栏 */}
        {allTags.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '12px 20px',
            marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            border: '1px solid #e8eaf6',
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8
          }}>
            <span style={{ fontSize: 13, color: '#888', marginRight: 4 }}>按标签筛选：</span>
            {allTags.map(tag => {
              const active = selectedTags.has(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.name)}
                  style={{
                    fontSize: 12, padding: '3px 12px', borderRadius: 999,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: active ? '#3949ab' : '#e8eaf6',
                    color: active ? '#fff' : '#3949ab',
                    border: `1px solid ${active ? '#3949ab' : '#c5cae9'}`,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {tag.name}
                </button>
              )
            })}
            {selectedTags.size > 0 && (
              <button
                onClick={() => setSelectedTags(new Set())}
                style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 999,
                  cursor: 'pointer', background: 'none',
                  border: '1px solid #e0e0e0', color: '#aaa'
                }}
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* 全部展开 / 收起 */}
        {filteredQuizzes.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={revealAll} style={secondaryBtn}>全部显示答案</button>
            <button onClick={hideAll} style={mutedBtn}>全部隐藏答案</button>
          </div>
        )}

        {/* 题目列表 */}
        {quizSet.quizzes.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', marginTop: 60 }}>还没有题目，回到列表上传吧 🎉</p>
        ) : filteredQuizzes.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', marginTop: 60 }}>没有符合条件的题目</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredQuizzes.map((quiz, index) => (
              <div key={quiz.id} style={{
                background: '#fff', borderRadius: 12, padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                border: '1px solid #e8eaf6'
              }}>
                {editingId === quiz.id ? (
                  /* 编辑模式 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ fontSize: 13, color: '#555' }}>题目
                      <textarea
                        value={editQuestion}
                        onChange={e => setEditQuestion(e.target.value)}
                        rows={2}
                        style={{ ...textareaStyle, marginTop: 4 }}
                      />
                    </label>
                    <label style={{ fontSize: 13, color: '#555' }}>答案
                      <textarea
                        value={editAnswer}
                        onChange={e => setEditAnswer(e.target.value)}
                        rows={2}
                        style={{ ...textareaStyle, marginTop: 4 }}
                      />
                    </label>
                    <label style={{ fontSize: 13, color: '#555' }}>标签（逗号分隔）
                      <input
                        value={editTags}
                        onChange={e => setEditTags(e.target.value)}
                        placeholder="例：数学, 微积分"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleSaveEdit(quiz.id)} disabled={saving} style={primaryBtn}>
                        {saving ? '保存中...' : '保存'}
                      </button>
                      <button onClick={cancelEdit} style={mutedBtn}>取消</button>
                    </div>
                  </div>
                ) : (
                  /* 查看模式 */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 15, flex: 1 }}>
                        Q{index + 1}. {quiz.question}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                        <button onClick={() => startEdit(quiz)} style={secondaryBtn}>编辑</button>
                        <button onClick={() => handleDeleteQuiz(quiz.id)} style={dangerBtn}>删除</button>
                      </div>
                    </div>

                    {quiz.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {quiz.tags.map(({ tag }) => (
                          <span key={tag.id} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 999,
                            background: selectedTags.has(tag.name) ? '#3949ab' : '#e8eaf6',
                            color: selectedTags.has(tag.name) ? '#fff' : '#3949ab',
                            border: `1px solid ${selectedTags.has(tag.name) ? '#3949ab' : '#c5cae9'}`
                          }}>{tag.name}</span>
                        ))}
                      </div>
                    )}

                    <button onClick={() => toggleReveal(quiz.id)} style={mutedBtn}>
                      {revealedIds.has(quiz.id) ? '隐藏答案' : '显示答案'}
                    </button>

                    {revealedIds.has(quiz.id) && (
                      <div style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        background: '#f0f4ff', borderLeft: '3px solid #3949ab',
                        fontSize: 14, color: '#333', lineHeight: 1.6
                      }}>
                        {quiz.answer}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 样式常量 ──────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  background: '#3949ab', color: '#fff', border: 'none',
  borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13
}

const secondaryBtn: React.CSSProperties = {
  background: '#e8eaf6', color: '#3949ab', border: '1px solid #c5cae9',
  borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13
}

const mutedBtn: React.CSSProperties = {
  background: '#f5f5f5', color: '#777', border: '1px solid #e0e0e0',
  borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13
}

const dangerBtn: React.CSSProperties = {
  background: '#fff0f0', color: '#e53935', border: '1px solid #ffcdd2',
  borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #ddd', fontSize: 14, resize: 'vertical',
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', display: 'block'
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid #ddd', fontSize: 14,
  fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box', display: 'block'
}
