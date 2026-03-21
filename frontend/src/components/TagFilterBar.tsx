// src/components/TagFilterBar.tsx
import TagSearchInput, { type TagOption } from './TagSearchInput'
import type { QuizFilterParams } from '../types'

interface TagItem {
  id: number
  name: string
  isGlobal?: boolean
}

interface Props {
  allTagObjects: TagItem[]
  globalTagObjects: TagItem[]
  filters: QuizFilterParams
  isAuthor: boolean
  showNewTagInput?: boolean
  newTagName?: string
  onFilterChange: (f: QuizFilterParams) => void
  onDeleteTag: (id: number, name: string) => void
  onShowNewTagInput?: () => void
  onHideNewTagInput?: () => void
  onNewTagNameChange?: (v: string) => void
  // name 只传，hook 内部决定走 tagMode 流程
  onCreateTag: (name: string) => void
}

export default function TagFilterBar({
  allTagObjects, globalTagObjects, filters, isAuthor,
  onFilterChange, onDeleteTag, onCreateTag,
}: Props) {

  const globalIds   = new Set(globalTagObjects.map(t => t.id))
  const activeTagId = (filters as any).tagId as number | undefined

  function toggleFilter(id: number) {
    onFilterChange({
      ...filters,
      tagId: activeTagId === id ? undefined : id,
    } as any)
  }

  function chipStyle(active: boolean, isGlobal: boolean): React.CSSProperties {
    if (active) return {
      fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
      background: '#1677ff', color: '#fff', border: '1px solid #1677ff',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }
    return {
      fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
      background: isGlobal ? '#f5f5f5' : '#e6f4ff',
      color:      isGlobal ? '#666'    : '#1677ff',
      border:     `1px solid ${isGlobal ? '#e0e0e0' : '#91caff'}`,
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }
  }

  const tagOptions: TagOption[] = allTagObjects.map(t => ({
    id: t.id, name: t.name, isGlobal: globalIds.has(t.id),
  }))

  return (
    <div style={{ marginBottom: 16 }}>

      {/* ── 筛选 chip 行 ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {allTagObjects.map(tag => {
          const isGlobal = globalIds.has(tag.id)
          return (
            <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button onClick={() => toggleFilter(tag.id)} style={chipStyle(activeTagId === tag.id, isGlobal)}>
                {tag.name}
              </button>
              {isAuthor && !isGlobal && (
                <button
                  onClick={() => onDeleteTag(tag.id, tag.name)}
                  title="删除标签"
                  style={{
                    fontSize: 11, padding: '0 3px', marginLeft: -6, borderRadius: '50%',
                    cursor: 'pointer', background: 'none', border: 'none', color: '#bbb',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                >×</button>
              )}
            </span>
          )
        })}

        {activeTagId !== undefined && (
          <button
            onClick={() => onFilterChange({ ...filters, tagId: undefined } as any)}
            style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 10,
              background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer',
            }}
          >✕ 清除</button>
        )}
      </div>

      {/* ── 搜索 / 新建标签输入框（作者才显示）──────────── */}
      {isAuthor && (
        <div style={{ maxWidth: 320 }}>
          <TagSearchInput
            options={tagOptions}
            selectedIds={activeTagId !== undefined ? [activeTagId] : []}
            onToggle={tag => toggleFilter(tag.id)}
            onCreateNew={onCreateTag}   // 单参数，不传 quizId → 走 tagMode
            canCreate={true}
            placeholder="搜索标签 / 新建标签…"
          />
        </div>
      )}
    </div>
  )
}
