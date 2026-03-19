import { useNavigate } from 'react-router-dom'
import type { QuizSet, Visibility, SortMode } from '../hooks/useQuizSet'
import { SORT_OPTIONS, VISIBILITY_LABEL } from '../hooks/useQuizSet'

interface Props {
  quizSet: QuizSet
  isAuthor: boolean
  canEdit: boolean
  isReorderMode: boolean
  isSelectMode: boolean
  isTagMode: boolean
  showAddForm: boolean
  showUpload: boolean
  showExport: boolean
  sortMode: SortMode
  onToggleAddForm: () => void
  onToggleUpload: () => void
  onToggleExport: () => void
  onEnterSelectMode: () => void
  onEnterReorderMode: () => void
  onSaveReorder: () => void
  onCancelReorder: () => void
  onSortChange: (mode: SortMode) => void
  onVisibilityChange: (v: Visibility) => void
}

export default function QuizSetHeader({
  quizSet, isAuthor, canEdit,
  isReorderMode, isSelectMode, isTagMode,
  showAddForm, showUpload, showExport,
  sortMode,
  onToggleAddForm, onToggleUpload, onToggleExport,
  onEnterSelectMode, onEnterReorderMode,
  onSaveReorder, onCancelReorder,
  onSortChange, onVisibilityChange,
}: Props) {
  const navigate = useNavigate()

  return (
    <>
      {/* 顶栏按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => navigate('/')}>← 返回</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canEdit && !isReorderMode && (
            <button onClick={onToggleAddForm}>{showAddForm ? '取消' : '＋ 添加题目'}</button>
          )}
          {canEdit && !isReorderMode && (
            <button onClick={onToggleUpload}>{showUpload ? '取消上传' : '📂 上传文件'}</button>
          )}
          {!isReorderMode && (
            <button onClick={onToggleExport}>{showExport ? '关闭导出' : '📤 导出'}</button>
          )}
          {canEdit && !isReorderMode && (
            <button onClick={onEnterSelectMode}>☑️ 批量删除</button>
          )}
          {!isReorderMode && (
            <select
              value={sortMode}
              onChange={e => onSortChange(e.target.value as SortMode)}
              style={{
                fontSize: 13, padding: '4px 8px', borderRadius: 6,
                border: '1px solid #d9d9d9', cursor: 'pointer',
                background: sortMode !== 'custom' ? '#e6f4ff' : undefined,
                color: sortMode !== 'custom' ? '#1677ff' : undefined
              }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {canEdit && !isSelectMode && !isTagMode && (
            isReorderMode ? (
              <>
                <button onClick={onSaveReorder} style={{ background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>
                  ✓ 保存排序
                </button>
                <button onClick={onCancelReorder}>取消</button>
              </>
            ) : (
              <button onClick={onEnterReorderMode}>⠿ 自定义排序</button>
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
              onChange={e => onVisibilityChange(e.target.value as Visibility)}
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
    </>
  )
}
