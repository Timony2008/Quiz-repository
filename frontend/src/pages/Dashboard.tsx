import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import UploadPanel from '../components/UploadPanel'

interface Tag {
  id: number
  name: string
}

interface QuizSet {
  id: number
  title: string
  description?: string
  author: { id: number; username: string }
  _count: { quizzes: number }
  tags: { tag: Tag }[]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [quizSets, setQuizSets] = useState<QuizSet[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [filterTag, setFilterTag] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchQuizSets = async (tag?: string) => {
    try {
      const url = tag ? `/quizzes/filter?tag=${encodeURIComponent(tag)}` : '/quizzes'
      const res = await api.get(url)
      setQuizSets(res.data)
    } catch {
      setError('获取题库失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTags = async () => {
    try {
      const res = await api.get('/quizzes/tags/all')
      setAllTags(res.data)
    } catch {}
  }

  useEffect(() => {
    fetchQuizSets()
    fetchAllTags()
  }, [])

  const handleFilterTag = (tagName: string) => {
    const next = filterTag === tagName ? '' : tagName
    setFilterTag(next)
    fetchQuizSets(next || undefined)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleCreateQuizSet = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await api.post('/quizzes', { title, description, tags })
      setTitle('')
      setDescription('')
      setTagInput('')
      setShowForm(false)
      fetchQuizSets()
      fetchAllTags()
    } catch {
      setError('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteQuizSet = async (id: number) => {
    if (!confirm('确定删除这个题库？')) return
    try {
      await api.delete(`/quizzes/${id}`)
      fetchQuizSets(filterTag || undefined)
    } catch {
      setError('删除失败')
    }
  }

  if (loading) return <p style={{ padding: 40, color: '#555' }}>加载中...</p>
  if (error)   return <p style={{ padding: 40, color: '#e53935' }}>{error}</p>

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
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#1a73e8' }}>📚 题库管理</span>
        <button onClick={handleLogout} style={{
          background: 'none', border: '1px solid #ccc', borderRadius: 6,
          padding: '5px 14px', cursor: 'pointer', fontSize: 13, color: '#555'
        }}>退出登录</button>
      </div>

      {/* ── 主体 ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

        {/* 标签筛选栏 */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {allTags.map(tag => (
              <span
                key={tag.id}
                onClick={() => handleFilterTag(tag.name)}
                style={{
                  fontSize: 12, padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                  background: filterTag === tag.name ? '#1a73e8' : '#e8eaf6',
                  color: filterTag === tag.name ? '#fff' : '#3949ab',
                  border: '1px solid ' + (filterTag === tag.name ? '#1a73e8' : '#c5cae9'),
                  transition: 'all 0.15s'
                }}
              >
                {tag.name}
              </span>
            ))}
            {filterTag && (
              <span onClick={() => handleFilterTag('')} style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a'
              }}>✕ 清除筛选</span>
            )}
          </div>
        )}

        {/* 新建按钮 */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowForm(v => !v)} style={{
            background: '#1a73e8', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer'
          }}>
            {showForm ? '取消' : '＋ 新建题库'}
          </button>
        </div>

        {/* 新建表单 */}
        {showForm && (
          <form onSubmit={handleCreateQuizSet} style={{
            background: '#fff', borderRadius: 12, padding: 24,
            marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <input
              placeholder="题库名称"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              placeholder="描述（可选）"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="标签（逗号分隔，如：数学, 物理）"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={submitting} style={{
              background: '#1a73e8', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 0', fontSize: 14, cursor: 'pointer'
            }}>
              {submitting ? '创建中...' : '创建'}
            </button>
          </form>
        )}

        {/* 题库列表 */}
        {quizSets.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', marginTop: 60 }}>还没有题库，点击上方新建吧 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quizSets.map(qs => (
              <div key={qs.id} style={{
                background: '#fff', borderRadius: 12, padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                border: '1px solid #e8eaf6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    onClick={() => navigate(`/quizset/${qs.id}`)}
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#1a73e8' }}>{qs.title}</div>
                    {qs.description && (
                      <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{qs.description}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                      {qs._count.quizzes} 道题 · 作者：{qs.author.username}
                    </div>
                    {qs.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {qs.tags.map(({ tag }) => (
                          <span key={tag.id} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 999,
                            background: '#e8eaf6', color: '#3949ab', border: '1px solid #c5cae9'
                          }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <button
                      onClick={() => setExpandedId(expandedId === qs.id ? null : qs.id)}
                      style={secondaryBtn}
                    >上传题目</button>
                    <button
                      onClick={() => handleDeleteQuizSet(qs.id)}
                      style={dangerBtn}
                    >删除</button>
                  </div>
                </div>

                {/* 上传面板 */}
                {expandedId === qs.id && (
                  <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
                  <UploadPanel
                    quizSetId={qs.id}
                    onDone={() => {           // ✅ 对应 UploadPanel 的 props
                      setExpandedId(null)
                      fetchQuizSets(filterTag || undefined)
                    }}
                  />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd',
  fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
  background: '#fafafa', color: '#222'
}

const secondaryBtn: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
  background: '#e8eaf6', color: '#3949ab', border: '1px solid #c5cae9'
}

const dangerBtn: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
  background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a'
}
