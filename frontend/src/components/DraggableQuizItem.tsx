import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MathText } from './MathText'
import type { Quiz } from '../type/quiz'   // ← 从共享文件 import

interface Props {
  quiz: Quiz
  canEdit: boolean
  isTagMode: boolean
  isSelectMode: boolean
  isReorderMode: boolean
  isSelected: boolean
  isRevealed: boolean
  isEditing: boolean
  editQuestion: string
  editAnswer: string
  editTagInput: string
  editDifficulty: string
  difficultyBadge?: React.ReactNode
  onToggleAnswer: () => void
  onToggleSelect: () => void
  onStartEdit: () => void
  onDelete: () => void
  onEditSave: () => void
  onEditCancel: () => void
  onEditQuestionChange: (v: string) => void
  onEditAnswerChange: (v: string) => void
  onEditTagInputChange: (v: string) => void
  onEditDifficultyChange: (v: string) => void
}

function toDiffNum(val: number | string | null | undefined): number {
  if (val == null) return -1
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? -1 : n
}

function difficultyColor(val: number | string | null | undefined): string {
  const n = toDiffNum(val)
  if (n < 0)   return '#999'
  if (n <= 4)   return '#52c41a'   // 绿：1 ~ 4
  if (n <= 5.5) return '#faad14'   // 黄：4 ~ 5.5
  return '#ff4d4f'                 // 红：5.5 ~ 7
}

export default function DraggableQuizItem(props: Props) {
  const {
    quiz, canEdit, isTagMode, isSelectMode, isReorderMode,
    isSelected, isRevealed, isEditing,
    editQuestion, editAnswer, editTagInput, editDifficulty,
    difficultyBadge,
    onToggleAnswer, onToggleSelect, onStartEdit, onDelete,
    onEditSave, onEditCancel,
    onEditQuestionChange, onEditAnswerChange, onEditTagInputChange, onEditDifficultyChange
  } = props

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: quiz.id, disabled: !isReorderMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const editDiffNum = parseFloat(editDifficulty)
  const editDiffValid =
    editDifficulty.trim() !== '' &&
    !isNaN(editDiffNum) &&
    editDiffNum >= 1 &&
    editDiffNum <= 7

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        padding: '12px 14px',
        marginBottom: 10,
        border: isTagMode && isSelected ? '1px solid #1677ff' : '1px solid #eee',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'flex-start',
        background: isTagMode && isSelected
          ? '#e6f4ff'
          : isDragging ? '#f9f9f9' : undefined,
        cursor: isTagMode ? 'pointer' : undefined,
        transition: 'border 0.15s, background 0.15s'
      }}
      onClick={isTagMode ? onToggleSelect : undefined}
    >
      {/* 拖拽把手 */}
      {isReorderMode && (
        <span
          {...attributes} {...listeners}
          style={{
            marginRight: 10, marginTop: 4, cursor: 'grab',
            color: '#bbb', fontSize: 18, flexShrink: 0, userSelect: 'none'
          }}
          title="拖拽排序"
        >⠿</span>
      )}

      {/* 多选框 */}
      {(isSelectMode || isTagMode) && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
          style={{ marginRight: 10, marginTop: 4, flexShrink: 0 }}
        />
      )}

      {/* ── 编辑态 ── */}
      {isEditing ? (
        <div style={{ flex: 1 }}>
          <textarea
            value={editQuestion}
            onChange={e => onEditQuestionChange(e.target.value)}
            rows={3}
            style={{
              width: '100%', marginBottom: 6, padding: '5px 8px',
              boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace'
            }}
          />
          {editQuestion && (
            <div style={{
              fontSize: 13, color: '#555', padding: '4px 8px',
              background: '#fafafa', borderRadius: 4, marginBottom: 8
            }}>
              预览：<MathText text={editQuestion} />
            </div>
          )}

          <textarea
            value={editAnswer}
            onChange={e => onEditAnswerChange(e.target.value)}
            rows={3}
            style={{
              width: '100%', marginBottom: 6, padding: '5px 8px',
              boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace'
            }}
          />
          {editAnswer && (
            <div style={{
              fontSize: 13, color: '#555', padding: '4px 8px',
              background: '#fafafa', borderRadius: 4, marginBottom: 8
            }}>
              预览：<MathText text={editAnswer} />
            </div>
          )}

          <input
            value={editTagInput}
            onChange={e => onEditTagInputChange(e.target.value)}
            placeholder="标签（逗号分隔）"
            style={{ width: '100%', marginBottom: 8, padding: '5px 8px', boxSizing: 'border-box' }}
          />

          {/* 难度输入 1 ~ 7 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input
              type="number"
              placeholder="难度（1 ~ 7，如 4.5）"
              value={editDifficulty}
              onChange={e => onEditDifficultyChange(e.target.value)}
              min={1} max={7} step={0.1}
              style={{
                width: 200, padding: '4px 8px',
                borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 13
              }}
            />
            {editDifficulty.trim() !== '' && (
              editDiffValid
                ? <span style={{ fontSize: 12, color: difficultyColor(editDiffNum) }}>
                    ⭐ {editDiffNum} Star
                  </span>
                : <span style={{ fontSize: 12, color: '#ff4d4f' }}>
                    请输入 1 ~ 7 的数字
                  </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEditSave}>保存</button>
            <button onClick={onEditCancel}>取消</button>
          </div>
        </div>

      ) : (
        /* ── 展示态 ── */
        <div style={{
          flex: 1, display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 500, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
            }}>
              <MathText text={quiz.question} />
              {difficultyBadge ?? (quiz.difficulty != null && (() => {
                const val = toDiffNum(quiz.difficulty)
                if (val === -1) return null
                const color = difficultyColor(val)
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
              })())}
            </div>

            <button
              onClick={e => { e.stopPropagation(); onToggleAnswer() }}
              style={{
                fontSize: 12, marginBottom: 6, padding: '2px 10px',
                borderRadius: 4, cursor: 'pointer',
                background: '#f5f5f5', border: '1px solid #ddd', color: '#555'
              }}
            >
              {isRevealed ? '隐藏答案' : '显示答案'}
            </button>

            {isRevealed && (
              <div style={{ color: '#555', fontSize: 14, marginBottom: 6 }}>
                <MathText text={quiz.answer} />
              </div>
            )}

            {quiz.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {quiz.tags.map(t => (
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

          {canEdit && !isTagMode && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
              <button
                onClick={e => { e.stopPropagation(); onStartEdit() }}
                style={{ fontSize: 13 }}
              >编辑</button>
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                style={{
                  fontSize: 13, color: '#ff4d4f',
                  background: 'none', border: 'none', cursor: 'pointer'
                }}
              >删除</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
