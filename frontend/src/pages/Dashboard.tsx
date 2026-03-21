import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'

interface QuizSet {
  id: number
  title: string
  description?: string
  visibility: Visibility
  author: { id: number; username: string }
  _count: { quizzes: number }
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  PRIVATE: '🔒 私有',
  PUBLIC: '🌐 公开只读',
  PUBLIC_EDIT: '✏️ 公开可编辑'
}

// Dashboard.tsx 顶部加这个函数
function getUserIdFromToken(): number | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.id ?? payload.sub ?? null
  } catch {
    return null
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [quizSets, setQuizSets] = useState<QuizSet[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE')
  const [showForm, setShowForm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  useEffect(() => {
    setCurrentUserId(getUserIdFromToken())
    fetchQuizSets()
  }, [])

  async function fetchQuizSets() {
    const res = await api.get('/quiz')
    setQuizSets(res.data)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await api.post('/quiz', { title, description, visibility })
    setTitle('')
    setDescription('')
    setVisibility('PRIVATE')
    setShowForm(false)
    fetchQuizSets()
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这个题库？')) return
    await api.delete(`/quiz/${id}`)
    fetchQuizSets()
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '32px 40px 0'   // ← 顶部加 24px
      }}>

      {/* 顶栏 */}
     <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 0 20px',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 24
        }}>
        <h2 style={{ margin: 0 }}>📚 我的题库</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowForm(v => !v)}>
            {showForm ? '取消' : '＋ 新建题库'}
          </button>
          <button onClick={handleLogout}>退出登录</button>
        </div>
        <button onClick={() => navigate('/tags')}>🏷️ 全局标签</button>
      </div>

      {/* 新建表单 */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          marginBottom: 24, padding: 16,
          border: '1px solid #ddd', borderRadius: 8
        }}>
          <div style={{ marginBottom: 10 }}>
            <input
              placeholder="题库标题 *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              placeholder="描述（可选）"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', boxSizing: 'border-box' }}
            />
          </div>

          {/* 权限选择 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>权限设置：</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['PRIVATE', 'PUBLIC', 'PUBLIC_EDIT'] as Visibility[]).map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                  />
                  {VISIBILITY_LABEL[v]}
                </label>
              ))}
            </div>
          </div>

          <button type="submit">创建</button>
        </form>
      )}

      {/* 题库列表 */}
      {quizSets.length === 0 ? (
        <div style={{ color: '#999', textAlign: 'center', marginTop: 60 }}>
          还没有题库，点击「新建题库」开始吧
        </div>
      ) : (
        quizSets.map(qs => (
          <div
            key={qs.id}
            style={{
              padding: '14px 16px',
              marginBottom: 12,
              border: '1px solid #eee',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div
              style={{ cursor: 'pointer', flex: 1 }}
              onClick={() => navigate(`/quiz/${qs.id}`)}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {qs.title}
                <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>
                  {VISIBILITY_LABEL[qs.visibility]}
                </span>
              </div>
              {qs.description && (
                <div style={{ fontSize: 13, color: '#666' }}>{qs.description}</div>
              )}
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                {qs._count.quizzes} 道题 · 作者：{qs.author.username}
              </div>
            </div>

            {/* 只有作者显示删除按钮 */}
            {qs.author.id === currentUserId && (
              <button
                onClick={e => { e.stopPropagation(); handleDelete(qs.id) }}
                style={{ marginLeft: 12, color: '#ff4d4f', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                删除
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
