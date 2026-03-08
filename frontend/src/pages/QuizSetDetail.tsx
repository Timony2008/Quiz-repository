import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { updateVisibility } from '../api'
import UploadPanel from '../components/UploadPanel'
import ExportPanel from '../components/ExportPanel'
import { MathText } from '../components/MathText'

type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'

interface Tag { id: number; name: string }
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
  visibility: Visibility
  author: { id: number; username: string }
  quizzes: Quiz[]
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  PRIVATE: '🔒 私有',
  PUBLIC: '🌐 公开只读',
  PUBLIC_EDIT: '✏️ 公开可编辑'
}

export default function QuizSetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)

  // ✅ 改动1：同步读取，不用 useState，避免时序问题
  // 替换原来的 currentUserId 读取逻辑
  const currentUserId = (() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.id ?? payload.userId ?? null
    } catch {
      return null
    }
  })()

  // 面板互斥
  const [showUpload, setShowUpload] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // 新增题目
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // 编辑题目
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTagInput, setEditTagInput] = useState('')

  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())

  //加状态
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  //批量管理标签
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function toggleAnswer(id: number) {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredQuizzes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredQuizzes.map(q => q.id)))
    }
  }

  function exitSelectMode() {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    // ✅ 改动2：删掉 setCurrentUserId，只保留 fetchQuizSet
    fetchQuizSet()
  }, [id])

  async function fetchQuizSet() {
    try {
      const res = await api.get(`/quiz/${id}`)
      setQuizSet(res.data)
    } catch (err: any) {
      console.error('fetchQuizSet 失败:', err?.response?.status, err?.response?.data)
      navigate('/')
    }
  }

  async function handleBatchDelete() {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 道题？此操作不可撤销。`)) return
    await api.delete('/quiz/batch', { data: { ids: Array.from(selectedIds) } })
    exitSelectMode()
    fetchQuizSet()
  }

  if (!quizSet) return <div style={{ padding: 40 }}>加载中...</div>

  const isAuthor = quizSet.author.id === currentUserId
  const canEdit = isAuthor || quizSet.visibility === 'PUBLIC_EDIT'

  const allTags = Array.from(
    new Set(quizSet.quizzes.flatMap(q => q.tags.map(t => t.tag.name)))
  )

  const filteredQuizzes = selectedTag
    ? quizSet.quizzes.filter(q => q.tags.some(t => t.tag.name === selectedTag))
    : quizSet.quizzes

  // ── 权限修改 ──────────────────────────────────────────────────
  async function handleVisibilityChange(v: Visibility) {
    await updateVisibility(quizSet!.id, v)
    setQuizSet(prev => prev ? { ...prev, visibility: v } : prev)
  }

  // ── 添加题目 ──────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    await api.post(`/quiz/${id}/items`, { question, answer, tags })
    setQuestion(''); setAnswer(''); setTagInput('')
    setShowAddForm(false)
    fetchQuizSet()
  }

  // ── 删除题目 ──────────────────────────────────────────────────
  async function handleDelete(quizId: number) {
    if (!confirm('确定删除这道题？')) return
    await api.delete(`/quiz/item/${quizId}`)
    fetchQuizSet()
  }

  // ── 编辑题目 ──────────────────────────────────────────────────
  function startEdit(q: Quiz) {
    setEditingId(q.id)
    setEditQuestion(q.question)
    setEditAnswer(q.answer)
    setEditTagInput(q.tags.map(t => t.tag.name).join(', '))
  }

  async function handleEditSave(quizId: number) {
    const tags = editTagInput.split(',').map(t => t.trim()).filter(Boolean)
    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion,
      answer: editAnswer,
      tags
    })
    setEditingId(null)
    fetchQuizSet()
  }

  return (
      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '32px 40px 0'   // ← 顶部加 24px
      }}>

      {/* 顶栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => navigate('/')}>← 返回</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button onClick={() => { setShowAddForm(v => !v); setShowUpload(false); setShowExport(false) }}>
              {showAddForm ? '取消' : '＋ 添加题目'}
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setShowUpload(v => !v); setShowAddForm(false); setShowExport(false) }}>
              {showUpload ? '取消上传' : '📂 上传文件'}
            </button>
          )}
          <button onClick={() => { setShowExport(v => !v); setShowAddForm(false); setShowUpload(false) }}>
            {showExport ? '关闭导出' : '📤 导出'}
          </button>
          {canEdit && (
          <button onClick={() => {
            setIsSelectMode(true)
            setShowAddForm(false)
            setShowUpload(false)
            setShowExport(false)
          }}>
            ☑️ 批量删除
          </button>
          )}
        </div>
      </div>

      {/* 题库标题 + 权限 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px' }}>{quizSet.title}</h2>
        {quizSet.description && (
          <div style={{ color: '#666', fontSize: 14, marginBottom: 6 }}>{quizSet.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#888' }}>
          <span>作者：{quizSet.author.username}</span>

          {isAuthor ? (
            <select
              value={quizSet.visibility}
              onChange={e => handleVisibilityChange(e.target.value as Visibility)}
              style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4 }}
            >
              <option value="PRIVATE">🔒 私有</option>
              <option value="PUBLIC">🌐 公开只读</option>
              <option value="PUBLIC_EDIT">✏️ 公开可编辑</option>
            </select>
          ) : (
            <span>{VISIBILITY_LABEL[quizSet.visibility]}</span>
          )}
        </div>
      </div>


      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#888', alignSelf: 'center' }}>标签筛选：</span>
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
              background: selectedTag === null ? '#1677ff' : '#f0f0f0',
              color: selectedTag === null ? '#fff' : '#555',
              border: 'none'
            }}
          >
            全部
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
              style={{
                fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                background: selectedTag === tag ? '#1677ff' : '#f0f0f0',
                color: selectedTag === tag ? '#fff' : '#555',
                border: 'none'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 面板区 */}
      {showUpload && canEdit && (
        <UploadPanel
          quizSetId={quizSet.id}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchQuizSet() }}
        />
      )}
      {showExport && (
        <ExportPanel quizzes={quizSet.quizzes} onClose={() => setShowExport(false)} />
      )}

      {/* 添加题目表单 */}
      {showAddForm && canEdit && (
        <form onSubmit={handleAdd} style={{
          marginBottom: 20, padding: 14,
          border: '1px solid #ddd', borderRadius: 8
        }}>
          <input placeholder="题目 *" value={question} onChange={e => setQuestion(e.target.value)}
            style={{ width: '100%', marginBottom: 8, padding: '6px 10px', boxSizing: 'border-box' }} />
          <input placeholder="答案 *" value={answer} onChange={e => setAnswer(e.target.value)}
            style={{ width: '100%', marginBottom: 8, padding: '6px 10px', boxSizing: 'border-box' }} />
          <input placeholder="标签（逗号分隔）" value={tagInput} onChange={e => setTagInput(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '6px 10px', boxSizing: 'border-box' }} />
          <button type="submit">保存</button>
        </form>
      )}

      {filteredQuizzes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => {
              const allRevealed = filteredQuizzes.every(q => revealedIds.has(q.id))
              if (allRevealed) {
                setRevealedIds(prev => {
                  const next = new Set(prev)
                  filteredQuizzes.forEach(q => next.delete(q.id))
                  return next
                })
              } else {
                setRevealedIds(prev => {
                  const next = new Set(prev)
                  filteredQuizzes.forEach(q => next.add(q.id))
                  return next
                })
              }
            }}
            style={{
              fontSize: 13, padding: '4px 14px', borderRadius: 6,
              cursor: 'pointer', background: '#f5f5f5',
              border: '1px solid #ddd', color: '#555'
            }}
          >
            {filteredQuizzes.every(q => revealedIds.has(q.id)) ? '全部隐藏答案' : '全部显示答案'}
          </button>
        </div>
      )}

      {/*选题区域*/}

      {isSelectMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px', background: '#fffbe6',
          border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 12
        }}>
          <input
            type="checkbox"
            checked={selectedIds.size === filteredQuizzes.length && filteredQuizzes.length > 0}
            onChange={toggleSelectAll}
          />
          <span style={{ fontSize: 13 }}>
            全选（已选 {selectedIds.size} / {filteredQuizzes.length} 题）
          </span>
          <button onClick={exitSelectMode} style={{ marginLeft: 'auto', fontSize: 13 }}>
            取消
          </button>
        </div>
      )}


      {/* 题目列表 */}
      {filteredQuizzes.length === 0 ? (
        <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>暂无题目</div>
      ) : (
        filteredQuizzes.map(q => (
          <div key={q.id} style={{
            padding: '12px 14px', marginBottom: 10,
            border: '1px solid #eee', borderRadius: 8,
            display: 'flex', alignItems: 'flex-start' 
            
          }}>
            {isSelectMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(q.id)}
                onChange={() => toggleSelect(q.id)}
                style={{ marginRight: 10, marginTop: 4, flexShrink: 0 }}
              />
            )}
            {editingId === q.id ? (
              <div style={{ flex: 1 }}>
                <input value={editQuestion} onChange={e => setEditQuestion(e.target.value)}
                  style={{ width: '100%', marginBottom: 6, padding: '5px 8px', boxSizing: 'border-box' }} />
                {editQuestion && (
                  <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
                    预览：<MathText text={editQuestion} />
                  </div>
                )}
                <input value={editAnswer} onChange={e => setEditAnswer(e.target.value)}
                  style={{ width: '100%', marginBottom: 6, padding: '5px 8px', boxSizing: 'border-box' }} />
                {editAnswer && (
                  <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
                    预览：<MathText text={editAnswer} />
                  </div>
                )}
                <input value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                  placeholder="标签（逗号分隔）"
                  style={{ width: '100%', marginBottom: 8, padding: '5px 8px', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleEditSave(q.id)}>保存</button>
                  <button onClick={() => setEditingId(null)}>取消</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}><MathText text={q.question} /></div>

                  <button
                    onClick={() => toggleAnswer(q.id)}
                    style={{
                      fontSize: 12, marginBottom: 6, padding: '2px 10px',
                      borderRadius: 4, cursor: 'pointer', background: '#f5f5f5',
                      border: '1px solid #ddd', color: '#555'
                    }}
                  >
                    {revealedIds.has(q.id) ? '隐藏答案' : '显示答案'}
                  </button>

                  {revealedIds.has(q.id) && (
                    <div style={{ color: '#555', fontSize: 14, marginBottom: 6 }}>
                      <MathText text={q.answer} />
                    </div>
                  )}
                  {q.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {q.tags.map(t => (
                        <span key={t.tag.id} style={{
                          background: '#f0f0f0', padding: '1px 8px',
                          borderRadius: 10, fontSize: 12
                        }}>
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                    <button onClick={() => startEdit(q)} style={{ fontSize: 13 }}>编辑</button>
                    <button onClick={() => handleDelete(q.id)}
                      style={{ fontSize: 13, color: '#ff4d4f', background: 'none', border: 'none', cursor: 'pointer' }}>
                      删除
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
      {isSelectMode && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #ddd', borderRadius: 12,
          padding: '12px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 100
        }}>
          <span style={{ fontSize: 14 }}>已选 <b>{selectedIds.size}</b> 题</span>
          <button
            onClick={handleBatchDelete}
            style={{
              background: '#ff4d4f', color: '#fff',
              border: 'none', borderRadius: 6,
              padding: '6px 18px', cursor: 'pointer', fontSize: 14
            }}
          >
            🗑️ 删除
          </button>
        </div>
      )}
    </div>
  )
}
