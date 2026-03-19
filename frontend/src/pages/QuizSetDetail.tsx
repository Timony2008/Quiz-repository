import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { useQuizSet } from '../hooks/useQuizSet'
import { useQuizEdit } from '../hooks/useQuizEdit'
import { useTagManager } from '../hooks/useTagManager'
import { useSelectMode } from '../hooks/useSelectMode'

import QuizSetHeader from '../components/QuizSetHeader'
import TagFilterBar from '../components/TagFilterBar'
import AddQuizForm from '../components/AddQuizForm'
import DraggableQuizItem from '../components/DraggableQuizItem'
import { DifficultyBadge } from '../components/DifficultyBadge'
import UploadPanel from '../components/UploadPanel'
import ExportPanel from '../components/ExportPanel'

// ── 当前用户 ID ───────────────────────────────────────────────
function getCurrentUserId(): number | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.id ?? payload.userId ?? null
  } catch { return null }
}

export default function QuizSetDetail() {
  const { id } = useParams()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [showUpload, setShowUpload] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())

  const quizSetHook = useQuizSet(id)
  const {
    quizSet, sortMode, setSortMode, filters, setFilters,
    isReorderMode, filteredQuizzes, allTagObjects, globalTagObjects,  // ← 加这个
    handleDragEnd, handleSaveReorder, enterReorderMode, cancelReorderMode,
    handleVisibilityChange, fetchQuizSet,
  } = quizSetHook

  const editHook = useQuizEdit(id, fetchQuizSet)
  const {
    showAddForm, setShowAddForm,
    question, setQuestion, answer, setAnswer,
    tagInput, setTagInput, difficulty, setDifficulty,
    editingId, setEditingId,
    editQuestion, setEditQuestion, editAnswer, setEditAnswer,
    editTagInput, setEditTagInput, editDifficulty, setEditDifficulty,
    handleAdd, handleDelete, startEdit, handleEditSave,
  } = editHook

  const selectHook = useSelectMode(filteredQuizzes, fetchQuizSet)
  const {
    isSelectMode, setIsSelectMode, selectedIds, setSelectedIds,
    toggleSelect, toggleSelectAll, exitSelectMode, handleBatchDelete,
  } = selectHook

  const tagHook = useTagManager(fetchQuizSet, filters, setFilters, quizSet?.id)
  const {
    showNewTagInput, setShowNewTagInput, newTagName, setNewTagName,
    newTagDimension, setNewTagDimension,   // ← 新增
    isTagMode, setIsTagMode,
    exitTagMode, handleCreateTag, handleDeleteTag, handleAttachTag,
  } = tagHook

  if (!quizSet) return <div style={{ padding: 40 }}>加载中...</div>

  const currentUserId = getCurrentUserId()
  const isAuthor = quizSet.author.id === currentUserId
  const canEdit = isAuthor || quizSet.visibility === 'PUBLIC_EDIT'

  function toggleAnswer(id: number) {
    setRevealedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function closeAllPanels() {
    setShowAddForm(false); setShowUpload(false); setShowExport(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 40px 0' }}>

      <QuizSetHeader
        quizSet={quizSet}
        isAuthor={isAuthor}
        canEdit={canEdit}
        isReorderMode={isReorderMode}
        isSelectMode={isSelectMode}
        isTagMode={isTagMode}
        showAddForm={showAddForm}
        showUpload={showUpload}
        showExport={showExport}
        sortMode={sortMode}
        onToggleAddForm={() => { setShowAddForm(v => !v); setShowUpload(false); setShowExport(false) }}
        onToggleUpload={() => { setShowUpload(v => !v); setShowAddForm(false); setShowExport(false) }}
        onToggleExport={() => { setShowExport(v => !v); setShowAddForm(false); setShowUpload(false) }}
        onEnterSelectMode={() => { setIsSelectMode(true); closeAllPanels() }}
        onEnterReorderMode={() => { enterReorderMode(); closeAllPanels(); setIsSelectMode(false); setSelectedIds(new Set()) }}
        onSaveReorder={handleSaveReorder}
        onCancelReorder={cancelReorderMode}
        onSortChange={setSortMode}
        onVisibilityChange={handleVisibilityChange}
      />

      <TagFilterBar
        allTagObjects={allTagObjects}
        globalTagObjects={globalTagObjects}
        filters={filters}                                    // ← 替换 selectedTag
        isAuthor={isAuthor}
        showNewTagInput={showNewTagInput}
        newTagName={newTagName}
        newTagDimension={newTagDimension}                    // ← 新增
        onFilterChange={setFilters}                          // ← 替换 onSelectTag
        onDeleteTag={handleDeleteTag}
        onShowNewTagInput={() => setShowNewTagInput(true)}
        onHideNewTagInput={() => { setShowNewTagInput(false); setNewTagName('') }}
        onNewTagNameChange={setNewTagName}
        onNewTagDimensionChange={setNewTagDimension}         // ← 新增
        onCreateTag={handleCreateTag}
      />

      {/* 模式提示栏 */}
      {isReorderMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>⠿ 拖拽左侧把手调整题目顺序，完成后点击「保存排序」</span>
        </div>
      )}
      {isTagMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>🏷️ 选择要打标签的题目（已选 <b>{selectedIds.size}</b> 题）</span>
          <button onClick={exitTagMode} style={{ marginLeft: 'auto', fontSize: 13 }}>取消</button>
        </div>
      )}

      {/* 面板区 */}
      {showUpload && canEdit && (
        <UploadPanel quizSetId={quizSet.id} onClose={() => setShowUpload(false)} onSuccess={() => { fetchQuizSet(); setShowUpload(false) }} />
      )}
      {showExport && <ExportPanel quizzes={quizSet.quizzes} onClose={() => setShowExport(false)} />}

      {showAddForm && canEdit && (
        <AddQuizForm
          question={question} answer={answer} tagInput={tagInput} difficulty={difficulty}
          onQuestionChange={setQuestion} onAnswerChange={setAnswer}
          onTagInputChange={setTagInput} onDifficultyChange={setDifficulty}
          onSubmit={handleAdd}
        />
      )}

      {/* 全选栏 + 显示/隐藏答案 */}
      {filteredQuizzes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {isSelectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, flex: 1, marginRight: 8 }}>
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
                if (allRevealed)
                  setRevealedIds(prev => { const n = new Set(prev); filteredQuizzes.forEach(q => n.delete(q.id)); return n })
                else
                  setRevealedIds(prev => { const n = new Set(prev); filteredQuizzes.forEach(q => n.add(q.id)); return n })
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
                key={q.id} quiz={q}
                canEdit={canEdit} isTagMode={isTagMode} isSelectMode={isSelectMode}
                isReorderMode={isReorderMode} isSelected={selectedIds.has(q.id)}
                isRevealed={revealedIds.has(q.id)} isEditing={editingId === q.id}
                editQuestion={editQuestion} editAnswer={editAnswer}
                editTagInput={editTagInput} editDifficulty={editDifficulty}
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
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: '12px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 16, zIndex: 100 }}>
          <span style={{ fontSize: 14 }}>已选 <b>{selectedIds.size}</b> 题</span>
          <button onClick={handleBatchDelete} style={{ background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer', fontSize: 14 }}>🗑️ 删除</button>
        </div>
      )}

      {/* 底部浮层：完成打标签 */}
      {isTagMode && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #91caff', borderRadius: 12, padding: '12px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 16, zIndex: 100 }}>
          <span style={{ fontSize: 14 }}>🏷️ 已选 <b>{selectedIds.size}</b> 题</span>
          <button onClick={() => handleAttachTag(selectedIds)} style={{ background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer', fontSize: 14 }}>✓ 完成打标签</button>
          <button onClick={exitTagMode} style={{ background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14 }}>取消</button>
        </div>
      )}

    </div>
  )
}
