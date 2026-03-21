// src/components/TagFilterBar.tsx
import { useState } from 'react'
import TagSearchInput, { type TagOption } from './TagSearchInput'
import type { QuizFilterParams } from '../types'

interface TagItem {
  id: number
  name: string
  isGlobal?: boolean
  parentId?: number | null
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
  onCreateTag: (name: string) => void
}

export default function TagFilterBar({
  allTagObjects, globalTagObjects, filters, isAuthor,
  onFilterChange, onDeleteTag, onCreateTag,
}: Props) {

  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set())

  const globalIds   = new Set(globalTagObjects.map(t => t.id))
  const activeTagIds = new Set<number>(((filters as any).tagIds ?? []) as number[])

  // ── 收集某父标签下所有子标签 id ────────────────────────────
  function childIds(parentId: number): number[] {
    return allTagObjects
      .filter(t => t.parentId === parentId)
      .map(t => t.id)
  }

  function collectDescendantIds(parentId: number): number[] {
    const result: number[] = []
    const stack: number[] = [parentId]

    while (stack.length > 0) {
      const cur = stack.pop()!
      const children = allTagObjects.filter(t => t.parentId === cur).map(t => t.id)
      result.push(...children)
      stack.push(...children)
    }

    return result
  }

  // 父标签是否「半高亮」：有子标签被选中，但父标签本身未被选中
  function isParentPartial(parentId: number): boolean {
    if (activeTagIds.has(parentId)) return false
    const descendants = collectDescendantIds(parentId)
    return descendants.some(id => activeTagIds.has(id))
  }

  function toggleFilter(id: number) {
    const next = new Set(activeTagIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)

    onFilterChange({
      ...filters,
      tagIds: Array.from(next),
    } as any)
  }

  function toggleParentFilter(parentId: number) {
    const ids = [parentId, ...collectDescendantIds(parentId)]
    const allSelected = ids.every(id => activeTagIds.has(id))

    const next = new Set(activeTagIds)
    if (allSelected) {
      ids.forEach(id => next.delete(id))
    } else {
      ids.forEach(id => next.add(id))
    }

    onFilterChange({
      ...filters,
      tagIds: Array.from(next),
    } as any)
  }

  function toggleExpand(id: number) {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── chip 样式 ───────────────────────────────────────────────
  function chipStyle(
    active: boolean,
    isGlobal: boolean,
    partial = false
  ): React.CSSProperties {
    if (active) return {
      fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
      background: '#1677ff', color: '#fff', border: '1px solid #1677ff',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      fontWeight: 600,
    }
    if (partial) return {
      fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
      background: '#e6f4ff', color: '#1677ff', border: '1px solid #91caff',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      opacity: 0.7,
    }
    return {
      fontSize: 12, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
      background: isGlobal ? '#f5f5f5' : '#e6f4ff',
      color:      isGlobal ? '#666'    : '#1677ff',
      border:     `1px solid ${isGlobal ? '#e0e0e0' : '#91caff'}`,
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }
  }

  // ── 分组 ────────────────────────────────────────────────────
  // 全局父标签（isGlobal=true, parentId=null）
  const globalParents = globalTagObjects.filter(t => !t.parentId)
  // 全局子标签
  const globalChildrenOf = (pid: number) =>
    globalTagObjects.filter(t => t.parentId === pid)
  // 私有标签
  const privateTags = allTagObjects.filter(t => !globalIds.has(t.id))

  const tagOptions: TagOption[] = allTagObjects.map(t => ({
    id: t.id, name: t.name,
    isGlobal: globalIds.has(t.id),
    parentId: t.parentId,
  }))

  return (
    <div style={{ marginBottom: 16 }}>

      {/* ── 全局标签（树形） ──────────────────────────────── */}
      {globalParents.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {globalParents.map(parent => {
              const children  = globalChildrenOf(parent.id)
              const isExpanded = expandedParents.has(parent.id)
              const isActive   = activeTagIds.has(parent.id)
              const isPartial  = isParentPartial(parent.id)

              return (
                <span key={parent.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {/* 父标签 chip */}
                  <button
                    onClick={() => toggleParentFilter(parent.id)}
                    style={chipStyle(isActive, true, isPartial)}
                  >
                    {parent.name}
                  </button>

                  {/* 展开按钮（有子标签才显示） */}
                  {children.length > 0 && (
                    <button
                      onClick={() => toggleExpand(parent.id)}
                      title={isExpanded ? '收起子标签' : '展开子标签'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: '#aaa', padding: '0 2px',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.15s',
                      }}
                    >▾</button>
                  )}

                  {/* 子标签（展开后内联显示） */}
                  {isExpanded && children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => toggleFilter(child.id)}
                      style={{
                        ...chipStyle(activeTagIds.has(child.id), true),
                        fontSize: 11,
                        opacity: 0.85,
                        marginLeft: 2,
                      }}
                    >
                      {child.name}
                    </button>
                  ))}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 私有标签（平铺）──────────────────────────────── */}
      {privateTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          {privateTags.map(tag => (
            <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                onClick={() => toggleFilter(tag.id)}
                style={chipStyle(activeTagIds.has(tag.id), false)}
              >
                {tag.name}
              </button>
              {isAuthor && (
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
          ))}
        </div>
      )}

      {/* ── 清除筛选 ──────────────────────────────────────── */}
      {activeTagIds.size > 0 && (
        <button
          onClick={() => onFilterChange({ ...filters, tagId: undefined } as any)}
          style={{
            fontSize: 12, padding: '2px 10px', borderRadius: 10, marginBottom: 8,
            background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer',
          }}
        >✕ 清除筛选</button>
      )}

      {/* ── 搜索 / 新建标签输入框 ────────────────────────── */}
      {isAuthor && (
        <div style={{ maxWidth: 320 }}>
          <TagSearchInput
            options={tagOptions}
            selectedIds={Array.from(activeTagIds)}
            onToggle={tag => toggleFilter(tag.id)}
            onCreateNew={onCreateTag}
            canCreate={true}
            placeholder="搜索标签 / 新建标签…"
          />
        </div>
      )}
    </div>
  )
}
