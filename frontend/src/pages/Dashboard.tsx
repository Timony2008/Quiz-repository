import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface QuizSet {
  id: number
  title: string
  description?: string
  author: { id: number; username: string }
  _count: { quizzes: number }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [quizSets, setQuizSets] = useState<QuizSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentUserId = Number(localStorage.getItem('userId'))

  useEffect(() => {
    fetchQuizSets()
  }, [])

  async function fetchQuizSets() {
    try {
      setLoading(true)
      const res = await api.get('/quiz')
      setQuizSets(res.data)
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      setSubmitting(true)
      await api.post('/quiz', { title: newTitle, description: newDesc })
      setNewTitle('')
      setNewDesc('')
      setShowForm(false)
      fetchQuizSets()
    } catch {
      setError('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这个题库？')) return
    try {
      await api.delete(`/quiz/${id}`)
      fetchQuizSets()
    } catch {
      setError('删除失败')
    }
  }

  function handleLogout() {
    localStorage.clear()
    navigate('/login')
  }

  if (loading) return <div style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>题库列表</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowForm(v => !v)}>
            {showForm ? '取消' : '+ 新建题库'}
          </button>
          <button onClick={handleLogout}>退出登录</button>
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="题库标题 *"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="描述（可选）"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? '创建中...' : '确认创建'}
          </button>
        </form>
      )}

      {quizSets.length === 0 ? (
        <p>还没有题库，点击新建吧！</p>
      ) : (
        quizSets.map(qs => (
          <div
            key={qs.id}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div
                style={{ cursor: 'pointer', flex: 1 }}
                onClick={() => navigate(`/quizset/${qs.id}`)}
              >
                <h3 style={{ margin: '0 0 4px' }}>{qs.title}</h3>
                {qs.description && <p style={{ margin: '0 0 4px', color: '#666' }}>{qs.description}</p>}
                <small style={{ color: '#999' }}>
                  作者：{qs.author.username} · {qs._count.quizzes} 道题
                </small>
              </div>
              {qs.author.id === currentUserId && (
                <button
                  onClick={() => handleDelete(qs.id)}
                  style={{ marginLeft: 8, color: 'red' }}
                >
                  删除
                </button>
              )}
            </div>
          </div>
        ))
      )}


    </div>
  )
}
