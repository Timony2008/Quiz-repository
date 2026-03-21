// src/components/TagFilterBar.tsx
import { useEffect, useMemo, useState } from 'react'
import TagSearchInput, { type TagOption } from './TagSearchInput'
import type { QuizFilterParams } from '../types'

type TagMatchMode = 'OR' | 'AND'
type TagViewMode = 'ALL' | 'SELECTED' | 'GROUPED'
type TagDimension = 'KNOWLEDGE' | 'METHOD' | 'SOURCE' | 'CONTEXT'


interface TagItem {
  id: number
  name: string
  isGlobal?: boolean
  parentId?: number | null
  dimension?: string
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const globalIds = new Set(globalTagObjects.map(t => t.id))
  const activeTagIds = new Set<number>(((filters as any).tagIds ?? []) as number[])

  const tagMatchMode: TagMatchMode = ((filters as any).tagMatchMode ?? 'OR') as TagMatchMode
  const tagViewMode: TagViewMode = ((filters as any).tagViewMode ?? 'GROUPED') as TagViewMode

  useEffect(() => {
    if (tagViewMode === 'GROUPED') {
      setExpandedGroups(new Set()) // 每次切到“按分类显示”都收起
    }
  }, [tagViewMode])

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
      tagId: undefined,
    } as any)
  }

  function toggleParentFilter(parentId: number) {
    const ids = [parentId, ...collectDescendantIds(parentId)]
    const allSelected = ids.every(id => activeTagIds.has(id))
    const next = new Set(activeTagIds)

    if (allSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))

    onFilterChange({
      ...filters,
      tagIds: Array.from(next),
      tagId: undefined,
    } as any)
  }

  function toggleExpand(id: number) {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleGroupExpand(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function chipStyle(active: boolean, isGlobal: boolean, partial = false): React.CSSProperties {
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
      color: isGlobal ? '#666' : '#1677ff',
      border: `1px solid ${isGlobal ? '#e0e0e0' : '#91caff'}`,
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }
  }

  const globalParents = globalTagObjects.filter(t => !t.parentId)
  const globalChildrenOf = (pid: number) => globalTagObjects.filter(t => t.parentId === pid)
  const privateTags = allTagObjects.filter(t => !globalIds.has(t.id))

  const visibleGlobalParents =
    tagViewMode === 'SELECTED'
      ? globalParents.filter(p => activeTagIds.has(p.id) || collectDescendantIds(p.id).some(id => activeTagIds.has(id)))
      : globalParents

  const visiblePrivateTags =
    tagViewMode === 'SELECTED'
      ? privateTags.filter(t => activeTagIds.has(t.id))
      : privateTags

  const visibleAllTags =
    tagViewMode === 'SELECTED'
      ? allTagObjects.filter(t => activeTagIds.has(t.id))
      : allTagObjects

  const grouped = useMemo(() => {
    const normalize = (d?: string): TagDimension => {
      if (d === 'KNOWLEDGE' || d === 'METHOD' || d === 'SOURCE' || d === 'CONTEXT') return d
      return 'CONTEXT'
    }

    const map: Record<TagDimension, TagItem[]> = {
      SOURCE: [],
      KNOWLEDGE: [],
      METHOD: [],
      CONTEXT: [],
    }

    for (const t of visibleAllTags) {
      map[normalize(t.dimension)].push(t)
    }

    ;(Object.keys(map) as TagDimension[]).forEach(k => {
      map[k] = map[k].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    })

    return map
  }, [visibleAllTags])

  const tagOptions: TagOption[] = allTagObjects.map(t => ({
    id: t.id,
    name: t.name,
    isGlobal: globalIds.has(t.id),
    parentId: t.parentId,
  }))

  const groupTitle: Record<TagDimension, string> = {
    SOURCE: '来源',
    KNOWLEDGE: '模块 / 知识点',
    METHOD: '思想方法',
    CONTEXT: '场景 / 其他',
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 新增：两个切换控件 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <select
          value={tagMatchMode}
          onChange={(e) => onFilterChange({ ...filters, tagMatchMode: e.target.value as TagMatchMode } as any)}
          style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
        >
          <option value="OR">任一命中 (OR)</option>
          <option value="AND">全部命中 (AND)</option>
        </select>

        <select
          value={tagViewMode}
          onChange={(e) => onFilterChange({ ...filters, tagViewMode: e.target.value as TagViewMode } as any)}
          style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6 }}
        >
          <option value="ALL">显示全部标签</option>
          <option value="SELECTED">仅显示已选</option>
          <option value="GROUPED">按分类显示</option>
        </select>
      </div>

      {/* GROUPED 视图 */}
      {tagViewMode === 'GROUPED' ? (
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          {(['SOURCE', 'KNOWLEDGE', 'METHOD', 'CONTEXT'] as TagDimension[]).map((k) => {
            const list = grouped[k]
            if (list.length === 0) return null
            const isOpen = expandedGroups.has(k)
            return (
              <div key={k}>
                <button
                  onClick={() => toggleGroupExpand(k)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#666',
                    marginBottom: 6,
                    padding: 0,
                  }}
                  title={isOpen ? '收起分组' : '展开分组'}
                >
                  {isOpen ? '▾' : '▸'} {groupTitle[k]}（{list.length}）
                </button>

                {isOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {list.map(tag => (
                      <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <button
                          onClick={() => toggleFilter(tag.id)}
                          style={chipStyle(activeTagIds.has(tag.id), globalIds.has(tag.id))}
                        >
                          {tag.name}
                        </button>
                        {!globalIds.has(tag.id) && isAuthor && (
                          <button
                            onClick={() => onDeleteTag(tag.id, tag.name)}
                            title="删除标签"
                            style={{
                              fontSize: 11, padding: '0 3px', marginLeft: -6, borderRadius: '50%',
                              cursor: 'pointer', background: 'none', border: 'none', color: '#bbb',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {/* 原有层级视图（ALL / SELECTED） */}
          {visibleGlobalParents.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {visibleGlobalParents.map(parent => {
                  const children = globalChildrenOf(parent.id).filter(c => (
                    tagViewMode === 'SELECTED' ? activeTagIds.has(c.id) : true
                  ))
                  const isExpanded = expandedParents.has(parent.id)
                  const isActive = activeTagIds.has(parent.id)
                  const isPartial = isParentPartial(parent.id)

                  return (
                    <span key={parent.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => toggleParentFilter(parent.id)}
                        style={chipStyle(isActive, true, isPartial)}
                      >
                        {parent.name}
                      </button>

                      {globalChildrenOf(parent.id).length > 0 && (
                        <button
                          onClick={() => toggleExpand(parent.id)}
                          title={isExpanded ? '收起子标签' : '展开子标签'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 10, color: '#aaa', padding: '0 2px',
                            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.15s',
                          }}
                        >
                          ▾
                        </button>
                      )}

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

          {visiblePrivateTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              {visiblePrivateTags.map(tag => (
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
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {activeTagIds.size > 0 && (
        <button
          onClick={() => onFilterChange({ ...filters, tagIds: [], tagId: undefined } as any)}
          style={{
            fontSize: 12, padding: '2px 10px', borderRadius: 10, marginBottom: 8,
            background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer',
          }}
        >
          ✕ 清除筛选
        </button>
      )}

      {isAuthor && (
        <div style={{ maxWidth: 320 }}>
          <TagSearchInput
            options={tagOptions}
            selectedIds={Array.from(activeTagIds)}
            onToggle={tag => toggleFilter(tag.id)}
            onToggleParentOnly={tag => toggleFilter(tag.id)}
            onToggleParentWithChildren={tag => toggleParentFilter(tag.id)}
            onCreateNew={onCreateTag}
            canCreate={true}
            placeholder="搜索标签 / 新建标签…"
          />
        </div>
      )}
    </div>
  )
}
