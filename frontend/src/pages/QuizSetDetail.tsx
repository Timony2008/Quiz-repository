import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable'
import api, { updateVisibility, reorderQuizzes } from '../api'
import UploadPanel from '../components/UploadPanel'
import ExportPanel from '../components/ExportPanel'
import { MathText } from '../components/MathText'
import DraggableQuizItem from '../components/DraggableQuizItem'

type Visibility = 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT'
type SortMode = 'custom' | 'difficulty_asc' | 'difficulty_desc' | 'time_desc' | 'time_asc'

interface Tag { id: number; name: string }
import type { Quiz } from '../type/quiz'
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

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'custom',          label: '⠿ 自定义顺序' },
  { value: 'difficulty_asc',  label: '⭐ 难度从低到高' },
  { value: 'difficulty_desc', label: '⭐ 难度从高到低' },
  { value: 'time_desc',       label: '🕐 最近更新优先' },
  { value: 'time_asc',        label: '🕐 最早更新优先' },
]

// ── 统一把 difficulty 转成 number 的工具函数 ──────────────────
function toDiffNum(val: number | string | null | undefined): number {
  if (val == null) return -1
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? -1 : n
}

function DifficultyBadge({ difficulty }: { difficulty?: number | string | null }) {
  if (difficulty == null) return null
  const val = typeof difficulty === 'string' ? parseFloat(difficulty) : difficulty
  if (isNaN(val)) return null
  const color =
    val <= 4   ? '#52c41a' :   // 绿：1 ~ 4
    val <= 5.5 ? '#faad14' :   // 黄：4 ~ 5.5
    '#ff4d4f'                  // 红：5.5 ~ 7
  return (
    <span style={{
      fontSize: 12, padding: '2px 8px', borderRadius: 10,
      background: color + '1a', color,
      border: `1px solid ${color}55`,
      fontWeight: 500, whiteSpace: 'nowrap'
    }}>
      ⭐ {val} Star
    </span>
  )
}

export default function QuizSetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('custom')

  const currentUserId = (() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.id ?? payload.userId ?? null
    } catch { return null }
  })()

  const [showUpload, setShowUpload] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTagInput, setEditTagInput] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('')

  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [isTagMode, setIsTagMode] = useState(false)
  const [pendingTagId, setPendingTagId] = useState<number | null>(null)

  const [isReorderMode, setIsReorderMode] = useState(false)
  const [localQuizzes, setLocalQuizzes] = useState<Quiz[]>([])

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  function toggleAnswer(id: number) {
    setRevealedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredQuizzes.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredQuizzes.map(q => q.id)))
  }
  function exitSelectMode() { setIsSelectMode(false); setSelectedIds(new Set()) }
  function exitTagMode() { setIsTagMode(false); setPendingTagId(null); setSelectedIds(new Set()) }

  useEffect(() => { fetchQuizSet() }, [id])

  async function fetchQuizSet() {
    try {
      const res = await api.get(`/quiz/${id}`)
      setQuizSet(res.data)
      setLocalQuizzes(res.data.quizzes)
    } catch (err: any) {
      console.error('fetchQuizSet 失败:', err?.response?.status, err?.response?.data)
      navigate('/')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalQuizzes(prev => {
      const oldIndex = prev.findIndex(q => q.id === active.id)
      const newIndex = prev.findIndex(q => q.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  async function handleSaveReorder() {
    const items = localQuizzes.map((q, i) => ({ id: q.id, order: i }))
    await reorderQuizzes(items)
    setIsReorderMode(false)
    fetchQuizSet()
  }

  function enterReorderMode() {
    setIsReorderMode(true)
    setSortMode('custom')
    setShowAddForm(false)
    setShowUpload(false)
    setShowExport(false)
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleBatchDelete() {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 道题？此操作不可撤销。`)) return
    await api.delete('/quiz/batch', { data: { ids: Array.from(selectedIds) } })
    exitSelectMode()
    fetchQuizSet()
  }

  async function handleDeleteTag(tagId: number, tagName: string) {
    if (!confirm(`删除标签「${tagName}」？\n只删标签，不删题目。`)) return
    await api.delete(`/tag/${tagId}`)
    if (selectedTag === tagName) setSelectedTag(null)
    fetchQuizSet()
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    try {
      const res = await api.post('/tag', { name: newTagName.trim() })
      const createdTag: Tag = res.data
      setNewTagName(''); setShowNewTagInput(false)
      setIsTagMode(true); setPendingTagId(createdTag.id); setSelectedIds(new Set())
      setShowAddForm(false); setShowUpload(false); setShowExport(false)
      fetchQuizSet()
    } catch (err: any) {
      if (err?.response?.status === 409) alert('标签已存在')
    }
  }

  async function handleAttachTag() {
    if (!pendingTagId || selectedIds.size === 0) { exitTagMode(); return }
    await api.post(`/tag/${pendingTagId}/attach`, { quizIds: Array.from(selectedIds) })
    exitTagMode(); fetchQuizSet()
  }

  if (!quizSet) return <div style={{ padding: 40 }}>加载中...</div>

  const isAuthor = quizSet.author.id === currentUserId
  const canEdit = isAuthor || quizSet.visibility === 'PUBLIC_EDIT'

  const allTagObjects: Tag[] = Array.from(
    new Map(
      quizSet.quizzes.flatMap(q => q.tags.map(t => t.tag)).map(t => [t.id, t])
    ).values()
  )

  // ── 排序 + 筛选 ───────────────────────────────────────────────
  const baseQuizzes = isReorderMode ? localQuizzes : quizSet.quizzes

  const sortedQuizzes = isReorderMode
    ? baseQuizzes
    : [...baseQuizzes].sort((a, b) => {
        switch (sortMode) {
          case 'difficulty_asc':
            return toDiffNum(a.difficulty) - toDiffNum(b.difficulty)   // ← 用 toDiffNum
          case 'difficulty_desc':
            return toDiffNum(b.difficulty) - toDiffNum(a.difficulty)   // ← 用 toDiffNum
          case 'time_desc':
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          case 'time_asc':
            return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          case 'custom':
          default:
            return (a.order ?? 0) - (b.order ?? 0)
        }
      })

  const filteredQuizzes = selectedTag
    ? sortedQuizzes.filter(q => q.tags.some(t => t.tag.name === selectedTag))
    : sortedQuizzes

  async function handleVisibilityChange(v: Visibility) {
    await updateVisibility(quizSet!.id, v)
    setQuizSet(prev => prev ? { ...prev, visibility: v } : prev)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    const diffVal = difficulty.trim() !== '' ? parseFloat(difficulty) : undefined
    if (diffVal !== undefined && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }
    await api.post(`/quiz/${id}/items`, {
      question, answer, tags,
      ...(diffVal !== undefined ? { difficulty: diffVal } : {})
    })
    setQuestion(''); setAnswer(''); setTagInput(''); setDifficulty('')
    setShowAddForm(false)
    fetchQuizSet()
  }

  async function handleDelete(quizId: number) {
    if (!confirm('确定删除这道题？')) return
    await api.delete(`/quiz/item/${quizId}`)
    fetchQuizSet()
  }

  function startEdit(q: Quiz) {
    setEditingId(q.id)
    setEditQuestion(q.question)
    setEditAnswer(q.answer)
    setEditTagInput(q.tags.map(t => t.tag.name).join(', '))
    setEditDifficulty(q.difficulty != null ? String(toDiffNum(q.difficulty)) : '')  // ← 统一转 number 再转 string
  }

  async function handleEditSave(quizId: number) {
    const tags = editTagInput.split(',').map(t => t.trim()).filter(Boolean)
    const diffVal = editDifficulty.trim() !== '' ? parseFloat(editDifficulty) : null
    if (diffVal !== null && (isNaN(diffVal) || diffVal < 1 || diffVal > 7)) {
      alert('难度请输入 1 ~ 7 之间的数字')
      return
    }
    await api.put(`/quiz/item/${quizId}`, {
      question: editQuestion,
      answer: editAnswer,
      tags,
      difficulty: diffVal
    })
    setEditingId(null)
    fetchQuizSet()
  }

  function difficultyHint(val: string) {
    if (val === '') return null
    const n = parseFloat(val)
    if (isNaN(n)) return <span style={{ color: '#ff4d4f', fontSize: 12 }}>请输入数字</span>
    if (n < 1 || n > 7) return <span style={{ color: '#ff4d4f', fontSize: 12 }}>范围 1 ~ 7</span>
    return <span style={{ color: '#52c41a', fontSize: 12 }}>⭐ {n} Star</span>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 40px 0' }}>

      {/* 顶栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => navigate('/')}>← 返回</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canEdit && !isReorderMode && (
            <button onClick={() => { setShowAddForm(v => !v); setShowUpload(false); setShowExport(false) }}>
              {showAddForm ? '取消' : '＋ 添加题目'}
            </button>
          )}
          {canEdit && !isReorderMode && (
            <button onClick={() => { setShowUpload(v => !v); setShowAddForm(false); setShowExport(false) }}>
              {showUpload ? '取消上传' : '📂 上传文件'}
            </button>
          )}
          {!isReorderMode && (
            <button onClick={() => { setShowExport(v => !v); setShowAddForm(false); setShowUpload(false) }}>
              {showExport ? '关闭导出' : '📤 导出'}
            </button>
          )}
          {canEdit && !isReorderMode && (
            <button onClick={() => {
              setIsSelectMode(true)
              setShowAddForm(false); setShowUpload(false); setShowExport(false)
            }}>
              ☑️ 批量删除
            </button>
          )}

          {!isReorderMode && (
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              style={{
                fontSize: 13, padding: '4px 8px', borderRadius: 6,
                border: '1px solid #d9d9d9', cursor: 'pointer',
                background: sortMode !== 'custom' ? '#e6f4ff' : undefined,
                color: sortMode !== 'custom' ? '#1677ff' : undefined
              }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {canEdit && !isSelectMode && !isTagMode && (
            isReorderMode ? (
              <>
                <button
                  onClick={handleSaveReorder}
                  style={{
                    background: '#1677ff', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '4px 14px', cursor: 'pointer'
                  }}
                >
                  ✓ 保存排序
                </button>
                <button onClick={() => { setIsReorderMode(false); setLocalQuizzes(quizSet.quizzes) }}>
                  取消
                </button>
              </>
            ) : (
              <button onClick={enterReorderMode}>⠿ 自定义排序</button>
            )
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

      {/* 标签筛选栏 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {allTagObjects.length > 0 && (
          <>
            <span style={{ fontSize: 13, color: '#888', alignSelf: 'center' }}>标签筛选：</span>
            <button
              onClick={() => setSelectedTag(null)}
              style={{
                fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                background: selectedTag === null ? '#1677ff' : '#f0f0f0',
                color: selectedTag === null ? '#fff' : '#555', border: 'none'
              }}
            >全部</button>
            {allTagObjects.map(tag => (
              <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  onClick={() => setSelectedTag(prev => prev === tag.name ? null : tag.name)}
                  style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                    background: selectedTag === tag.name ? '#1677ff' : '#f0f0f0',
                    color: selectedTag === tag.name ? '#fff' : '#555', border: 'none'
                  }}
                >{tag.name}</button>
                {isAuthor && (
                  <button
                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                    title="删除标签"
                    style={{
                      fontSize: 11, lineHeight: 1, padding: '1px 4px', borderRadius: '50%',
                      cursor: 'pointer', background: 'none', border: 'none', color: '#bbb', marginLeft: -4
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                  >×</button>
                )}
              </span>
            ))}
          </>
        )}
        {isAuthor && (
          showNewTagInput ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                autoFocus value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateTag()
                  if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagName('') }
                }}
                placeholder="标签名"
                style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, border: '1px solid #1677ff', outline: 'none', width: 90 }}
              />
              <button onClick={handleCreateTag} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 8, background: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer' }}>确认</button>
              <button onClick={() => { setShowNewTagInput(false); setNewTagName('') }} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer' }}>取消</button>
            </span>
          ) : (
            <button
              onClick={() => setShowNewTagInput(true)}
              style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer', background: '#f6ffed', color: '#52c41a', border: '1px dashed #b7eb8f' }}
            >＋ 新建标签</button>
          )
        )}
      </div>

      {/* 排序模式提示栏 */}
      {isReorderMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px', background: '#fffbe6',
          border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 12
        }}>
          <span style={{ fontSize: 13 }}>⠿ 拖拽左侧把手调整题目顺序，完成后点击「保存排序」</span>
        </div>
      )}

      {/* 打标签模式提示栏 */}
      {isTagMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px', background: '#e6f4ff',
          border: '1px solid #91caff', borderRadius: 8, marginBottom: 12
        }}>
          <span style={{ fontSize: 13 }}>🏷️ 选择要打标签的题目（已选 <b>{selectedIds.size}</b> 题）</span>
          <button onClick={exitTagMode} style={{ marginLeft: 'auto', fontSize: 13 }}>取消</button>
        </div>
      )}

      {/* 面板区 */}
      {showUpload && canEdit && (
        <UploadPanel quizSetId={quizSet.id} onClose={() => setShowUpload(false)} onSuccess={() => { fetchQuizSet(); setShowUpload(false) }} />
      )}
      {showExport && (
        <ExportPanel quizzes={quizSet.quizzes} onClose={() => setShowExport(false)} />
      )}

      {/* 添加题目表单 */}
      {showAddForm && canEdit && (
        <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 14, border: '1px solid #ddd', borderRadius: 8 }}>
          <textarea
            placeholder="题目 *" value={question} onChange={e => setQuestion(e.target.value)} rows={3}
            style={{ width: '100%', marginBottom: 4, padding: '6px 10px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }}
          />
          {question && (
            <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
              预览：<MathText text={question} />
            </div>
          )}
          <textarea
            placeholder="答案 *" value={answer} onChange={e => setAnswer(e.target.value)} rows={3}
            style={{ width: '100%', marginBottom: 4, padding: '6px 10px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }}
          />
          {answer && (
            <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
              预览：<MathText text={answer} />
            </div>
          )}
          <input
            placeholder="标签（逗号分隔）" value={tagInput} onChange={e => setTagInput(e.target.value)}
            style={{ width: '100%', marginBottom: 8, padding: '6px 10px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input
              type="number"
              placeholder="难度（1 ~ 7，如 4.5）"
              min={1} max={7} step={0.1}
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              style={{ width: 200, padding: '4px 8px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 13 }}
            />
            {difficultyHint(difficulty)}
          </div>
          <button type="submit">保存</button>
        </form>
      )}

      {/* 全选栏 + 显示/隐藏答案 */}
      {filteredQuizzes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {isSelectMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', background: '#fffbe6',
              border: '1px solid #ffe58f', borderRadius: 8, flex: 1, marginRight: 8
            }}>
              <input
                type="checkbox"
                checked={selectedIds.size === filteredQuizzes.length && filteredQuizzes.length > 0}
                onChange={toggleSelectAll}
              />
              <span style={{ fontSize: 13 }}>全选（已选 {selectedIds.size} / {filteredQuizzes.length} 题）</span>
              <button onClick={exitSelectMode} style={{ marginLeft: 'auto', fontSize: 13 }}>取消</button>
            </div>
          )}
          {!isReorderMode && (
            <button
              onClick={() => {
                const allRevealed = filteredQuizzes.every(q => revealedIds.has(q.id))
                if (allRevealed) {
                  setRevealedIds(prev => { const n = new Set(prev); filteredQuizzes.forEach(q => n.delete(q.id)); return n })
                } else {
                  setRevealedIds(prev => { const n = new Set(prev); filteredQuizzes.forEach(q => n.add(q.id)); return n })
                }
              }}
              style={{ fontSize: 13, padding: '4px 14px', borderRadius: 6, cursor: 'pointer', background: '#f5f5f5', border: '1px solid #ddd', color: '#555', marginLeft: 'auto' }}
            >
              {filteredQuizzes.every(q => revealedIds.has(q.id)) ? '全部隐藏答案' : '全部显示答案'}
            </button>
          )}
        </div>
      )}

      {/* 题目列表 */}
      {filteredQuizzes.length === 0 ? (
        <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>暂无题目</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredQuizzes.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {filteredQuizzes.map(q => (
              <DraggableQuizItem
                key={q.id}
                quiz={q}
                canEdit={canEdit}
                isTagMode={isTagMode}
                isSelectMode={isSelectMode}
                isReorderMode={isReorderMode}
                isSelected={selectedIds.has(q.id)}
                isRevealed={revealedIds.has(q.id)}
                isEditing={editingId === q.id}
                editQuestion={editQuestion}
                editAnswer={editAnswer}
                editTagInput={editTagInput}
                editDifficulty={editDifficulty}
                difficultyBadge={<DifficultyBadge difficulty={q.difficulty} />}
                onToggleAnswer={() => toggleAnswer(q.id)}
                onToggleSelect={() => toggleSelect(q.id)}
                onStartEdit={() => startEdit(q)}
                onDelete={() => handleDelete(q.id)}
                onEditSave={() => handleEditSave(q.id)}
                onEditCancel={() => setEditingId(null)}
                onEditQuestionChange={setEditQuestion}
                onEditAnswerChange={setEditAnswer}
                onEditTagInputChange={setEditTagInput}
                onEditDifficultyChange={setEditDifficulty}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* 底部浮层：批量删除 */}
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
            style={{ background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer', fontSize: 14 }}
          >
            🗑️ 删除
          </button>
        </div>
      )}

      {/* 底部浮层：完成打标签 */}
      {isTagMode && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #91caff', borderRadius: 12,
          padding: '12px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 100
        }}>
          <span style={{ fontSize: 14 }}>🏷️ 已选 <b>{selectedIds.size}</b> 题</span>
          <button
            onClick={handleAttachTag}
            style={{ background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer', fontSize: 14 }}
          >
            ✓ 完成打标签
          </button>
          <button
            onClick={exitTagMode}
            style={{ background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14 }}
          >
            取消
          </button>
        </div>
      )}

    </div>
  )
}
