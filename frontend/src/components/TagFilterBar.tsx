import type { QuizFilterParams } from '../types'



// dimension 显示名映射
const DIM_LABEL: Record<string, string> = {
  KNOWLEDGE: '知识点',
  METHOD:    '方法',
  SOURCE:    '来源',
  CONTEXT:   '背景',
}

const DIM_COLOR: Record<string, { bg: string; active: string; text: string }> = {
  KNOWLEDGE: { bg: '#f0f5ff', active: '#2f54eb', text: '#2f54eb' },
  METHOD:    { bg: '#f6ffed', active: '#52c41a', text: '#52c41a' },
  SOURCE:    { bg: '#fff7e6', active: '#fa8c16', text: '#fa8c16' },
  CONTEXT:   { bg: '#f9f0ff', active: '#722ed1', text: '#722ed1' },
}

interface TagItem {
  id: number
  name: string
  dimension?: string | null
}

interface Props {
  allTagObjects: TagItem[]
  globalTagObjects: TagItem[]    // ← 新增
  filters: QuizFilterParams
  isAuthor: boolean
  showNewTagInput: boolean
  newTagName: string
  newTagDimension: string
  onFilterChange: (f: QuizFilterParams) => void
  onDeleteTag: (id: number, name: string) => void
  onShowNewTagInput: () => void
  onHideNewTagInput: () => void
  onNewTagNameChange: (v: string) => void
  onNewTagDimensionChange: (d: string) => void
  onCreateTag: () => void
}

export default function TagFilterBar({
  allTagObjects, globalTagObjects, filters, isAuthor,
  showNewTagInput, newTagName, newTagDimension,
  onFilterChange, onDeleteTag,
  onShowNewTagInput, onHideNewTagInput,
  onNewTagNameChange, onNewTagDimensionChange, onCreateTag,
}: Props) {

  // 按 dimension 分组
  const grouped = allTagObjects.reduce<Record<string, TagItem[]>>((acc, tag) => {
    const dim = tag.dimension ?? 'CONTEXT'
    if (!acc[dim]) acc[dim] = []
    acc[dim].push(tag)
    return acc
  }, {})

  const dimOrder = ['KNOWLEDGE', 'METHOD', 'SOURCE', 'CONTEXT']

  function toggleTag(dim: string, name: string) {
    const key = dim.toLowerCase() as keyof QuizFilterParams
    const current = filters[key]
    onFilterChange({ ...filters, [key]: current === name ? undefined : name })
  }

  function isActive(dim: string, name: string) {
    const key = dim.toLowerCase() as keyof QuizFilterParams
    return filters[key] === name
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── 全局标签行（只读，不显示删除按钮）── */}
      {dimOrder.map(dim => {
        const tags = globalTagObjects.filter(t => t.dimension === dim)
        if (tags.length === 0) return null
        const color = DIM_COLOR[dim]
        const key = dim.toLowerCase() as keyof QuizFilterParams

        return (
          <div key={`global-${dim}`} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#aaa', minWidth: 40 }}>{DIM_LABEL[dim]}：</span>
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(dim, tag.name)}
                style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                  background: isActive(dim, tag.name) ? color.active : color.bg,
                  color: isActive(dim, tag.name) ? '#fff' : color.text,
                  border: `1px solid ${isActive(dim, tag.name) ? color.active : 'transparent'}`,
                }}
              >{tag.name}</button>
            ))}
          </div>
        )
      })}

      {/* ── 各维度标签行 ── */}
      {dimOrder.map(dim => {
        const tags = grouped[dim]
        if (!tags || tags.length === 0) return null
        const color = DIM_COLOR[dim]
        const key = dim.toLowerCase() as keyof QuizFilterParams
        const hasActive = !!filters[key]

        return (
          <div key={dim} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#aaa', minWidth: 40 }}>{DIM_LABEL[dim]}：</span>

            {/* 全部（清除该维度筛选）*/}
            {hasActive && (
              <button
                onClick={() => onFilterChange({ ...filters, [key]: undefined })}
                style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                  background: '#f0f0f0', color: '#555', border: 'none'
                }}
              >全部</button>
            )}

            {tags.map(tag => (
              <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  onClick={() => toggleTag(dim, tag.name)}
                  style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
                    background: isActive(dim, tag.name) ? color.active : color.bg,
                    color: isActive(dim, tag.name) ? '#fff' : color.text,
                    border: `1px solid ${isActive(dim, tag.name) ? color.active : 'transparent'}`,
                  }}
                >{tag.name}</button>

                {isAuthor && (
                  <button
                    onClick={() => onDeleteTag(tag.id, tag.name)}
                    title="删除标签"
                    style={{
                      fontSize: 11, padding: '1px 4px', borderRadius: '50%',
                      cursor: 'pointer', background: 'none', border: 'none',
                      color: '#bbb', marginLeft: -4
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                  >×</button>
                )}
              </span>
            ))}
          </div>
        )
      })}

      {/* ── 新建标签 ── */}
      {isAuthor && (
        showNewTagInput ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              autoFocus value={newTagName}
              onChange={e => onNewTagNameChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onCreateTag()
                if (e.key === 'Escape') onHideNewTagInput()
              }}
              placeholder="标签名"
              style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 8,
                border: '1px solid #1677ff', outline: 'none', width: 90
              }}
            />
            <select
              value={newTagDimension}
              onChange={e => onNewTagDimensionChange(e.target.value)}
              style={{
                fontSize: 12, padding: '2px 6px', borderRadius: 8,
                border: '1px solid #d9d9d9', outline: 'none'
              }}
            >
              {dimOrder.map(d => (
                <option key={d} value={d}>{DIM_LABEL[d]}</option>
              ))}
            </select>
            <button
              onClick={onCreateTag}
              style={{
                fontSize: 12, padding: '2px 10px', borderRadius: 8,
                background: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer'
              }}
            >确认</button>
            <button
              onClick={onHideNewTagInput}
              style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 8,
                background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer'
              }}
            >取消</button>
          </div>
        ) : (
          <button
            onClick={onShowNewTagInput}
            style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 10, cursor: 'pointer',
              background: '#f6ffed', color: '#52c41a', border: '1px dashed #b7eb8f',
              marginTop: 4
            }}
          >＋ 新建标签</button>
        )
      )}
    </div>
  )
}
