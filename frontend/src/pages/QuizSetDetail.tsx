import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { useQuizSet }    from '../hooks/useQuizSet'
import { useQuizEdit }   from '../hooks/useQuizEdit'
import { useTagManager } from '../hooks/useTagManager'
import { useSelectMode } from '../hooks/useSelectMode'

import QuizSetHeader     from '../components/QuizSetHeader'
import TagFilterBar      from '../components/TagFilterBar'
import AddQuizForm       from '../components/AddQuizForm'
import DraggableQuizItem from '../components/DraggableQuizItem'
import { DifficultyBadge } from '../components/DifficultyBadge'
import UploadPanel       from '../components/UploadPanel'
import ExportPanel       from '../components/ExportPanel'
import TagSearchInput, { type TagOption } from '../components/TagSearchInput'

function getCurrentUserId(): number | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.id ?? payload.userId ?? null
  } catch {
    return null
  }
}

export default function QuizSetDetail() {
  const { id } = useParams()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const [showUpload, setShowUpload] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())

  const quizSetHook = useQuizSet(id)
  const {
    quizSet,
    sortMode, setSortMode,
    filters, setFilters,
    isReorderMode,
    filteredQuizzes,
    allTagObjects,
    globalTagObjects,
    handleDragEnd,
    handleSaveReorder,
    enterReorderMode,
    cancelReorderMode,
    handleVisibilityChange,
    fetchQuizSet,
  } = quizSetHook

  const editHook = useQuizEdit(id, fetchQuizSet)
  const {
    showAddForm, setShowAddForm,
    question, setQuestion,
    answer, setAnswer,
    tagInput, setTagInput,
    difficulty, setDifficulty,
    editingId, setEditingId,
    editQuestion, setEditQuestion,
    editAnswer, setEditAnswer,
    editTagInput, setEditTagInput,
    editTagIds, setEditTagIds,
    editDifficulty, setEditDifficulty,
    handleAdd, handleDelete, startEdit, handleEditSave,
  } = editHook

  const selectHook = useSelectMode(filteredQuizzes, fetchQuizSet)
  const {
    isSelectMode, setIsSelectMode,
    selectedIds, setSelectedIds,
    toggleSelect, toggleSelectAll,
    exitSelectMode, handleBatchDelete,
  } = selectHook

  const tagHook = useTagManager(fetchQuizSet, filters, setFilters, quizSet?.id)
  const {
    showNewTagInput, setShowNewTagInput,
    newTagName, setNewTagName,
    isTagMode,
    pendingTagId,
    setPendingTagId,
    enterTagMode,
    exitTagMode,
    handleCreateTag,
    handleDeleteTag,
    handleAttachTag,
  } = tagHook

  if (!quizSet) return <div style={{ padding: 40 }}>加载中...</div>

  const currentUserId = getCurrentUserId()
  const isAuthor = quizSet.author.id === currentUserId
  const canEdit  = isAuthor || quizSet.visibility === 'PUBLIC_EDIT'

  const globalIds = new Set(globalTagObjects.map(t => t.id))
  const tagOptions: TagOption[] = allTagObjects.map(t => ({
    id: t.id,
    name: t.name,
    isGlobal: globalIds.has(t.id),
    parentId: (t as any).parentId ?? null,
  }))

  const pendingTag = pendingTagId
    ? tagOptions.find(t => t.id === pendingTagId) ?? null
    : null

  function toggleAnswer(qid: number) {
    setRevealedIds(prev => {
      const next = new Set(prev)
      next.has(qid) ? next.delete(qid) : next.add(qid)
      return next
    })
  }

  function closeAllPanels() {
    setShowAddForm(false)
    setShowUpload(false)
    setShowExport(false)
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
        onEnterTagMode={() => {
          enterTagMode()
          closeAllPanels()
          setIsSelectMode(false)
          setSelectedIds(new Set())
        }}
        onEnterReorderMode={() => {
          enterReorderMode()
          closeAllPanels()
          setIsSelectMode(false)
          setSelectedIds(new Set())
        }}
        onSaveReorder={handleSaveReorder}
        onCancelReorder={cancelReorderMode}
        onSortChange={setSortMode}
        onVisibilityChange={handleVisibilityChange}
      />

      <TagFilterBar
        allTagObjects={allTagObjects}
        globalTagObjects={globalTagObjects}
        filters={filters}
        isAuthor={isAuthor}
        showNewTagInput={showNewTagInput}
        newTagName={newTagName}
        onFilterChange={setFilters}
        onDeleteTag={handleDeleteTag}
        onShowNewTagInput={() => setShowNewTagInput(true)}
        onHideNewTagInput={() => { setShowNewTagInput(false); setNewTagName('') }}
        onNewTagNameChange={setNewTagName}
        onCreateTag={handleCreateTag}
      />

      {isTagMode && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 12px', marginBottom: 12,
          background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13 }}>
              🏷️ 批量打标签：先选标签，再勾题（已选 <b>{selectedIds.size}</b> 题）
            </span>
            <button onClick={exitTagMode} style={{ marginLeft: 'auto', fontSize: 13 }}>取消</button>
          </div>

          <div style={{ maxWidth: 420 }}>
            <TagSearchInput
              options={tagOptions}
              selectedIds={pendingTagId ? [pendingTagId] : []}
              onToggle={(tag) => setPendingTagId(tag.id)}
              onCreateNew={undefined}
              canCreate={false}
              placeholder="选择要批量应用的已有标签"
            />
          </div>

          <div style={{ fontSize: 12, color: '#555' }}>
            当前标签：{pendingTag ? `「${pendingTag.name}」` : '（未选择）'}
          </div>
        </div>
      )}

      {isReorderMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px', marginBottom: 12,
          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8,
        }}>
          <span style={{ fontSize: 13 }}>⠿ 拖拽左侧把手调整题目顺序，完成后点击「保存排序」</span>
        </div>
      )}

      {showUpload && canEdit && (
        <UploadPanel
          quizSetId={quizSet.id}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { fetchQuizSet(); setShowUpload(false) }}
        />
      )}

      {showExport && (
        <ExportPanel quizzes={quizSet.quizzes} onClose={() => setShowExport(false)} />
      )}

      {showAddForm && canEdit && (
        <AddQuizForm
          question={question} answer={answer}
          tagInput={tagInput} difficulty={difficulty}
          onQuestionChange={setQuestion}
          onAnswerChange={setAnswer}
          onTagInputChange={setTagInput}
          onDifficultyChange={setDifficulty}
          onSubmit={handleAdd}
        />
      )}

      {filteredQuizzes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {isSelectMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', flex: 1, marginRight: 8,
              background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8,
            }}>
              <input
                type="checkbox"
                checked={selectedIds.size === filteredQuizzes.length && filteredQuizzes.length > 0}
                onChange={toggleSelectAll}
              />
              <span style={{ fontSize: 13 }}>
                全选（已选 {selectedIds.size} / {filteredQuizzes.length} 题）
              </span>
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
              style={{
                fontSize: 13, padding: '4px 14px', borderRadius: 6,
                cursor: 'pointer', background: '#f5f5f5',
                border: '1px solid #ddd', color: '#555', marginLeft: 'auto',
              }}
            >
              {filteredQuizzes.every(q => revealedIds.has(q.id)) ? '全部隐藏答案' : '全部显示答案'}
            </button>
          )}
        </div>
      )}

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
                editTagIds={editTagIds}
                tagOptions={tagOptions}
                onEditTagToggle={tag =>
                  setEditTagIds(prev =>
                    prev.includes(tag.id)
                      ? prev.filter(i => i !== tag.id)
                      : [...prev, tag.id]
                  )
                }
                onEditTagCreate={handleCreateTag}
                canCreate={isAuthor}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {isSelectMode && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #ddd', borderRadius: 12,
          padding: '12px 24px', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 14 }}>已选 <b>{selectedIds.size}</b> 题</span>
          <button
            onClick={handleBatchDelete}
            style={{ background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', cursor: 'pointer', fontSize: 14 }}
          >🗑️ 删除</button>
        </div>
      )}

      {isTagMode && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid #91caff', borderRadius: 12,
          padding: '12px 24px', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 14 }}>
            🏷️ {pendingTag ? `标签「${pendingTag.name}」` : '未选标签'}，已选 <b>{selectedIds.size}</b> 题
          </span>
          <button
            onClick={() => handleAttachTag(selectedIds)}
            disabled={!pendingTagId || selectedIds.size === 0}
            style={{
              background: (!pendingTagId || selectedIds.size === 0) ? '#bfbfbf' : '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 18px',
              cursor: (!pendingTagId || selectedIds.size === 0) ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            ✓ 应用标签
          </button>
          <button
            onClick={exitTagMode}
            style={{ background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14 }}
          >取消</button>
        </div>
      )}
    </div>
  )
}
