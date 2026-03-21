// src/components/TagSearchInput.tsx
import { useState, useRef, useEffect, useMemo } from 'react'

export interface TagOption {
  id: number
  name: string
  isGlobal?: boolean
  parentId?: number | null
}

interface Props {
  options: TagOption[]
  selectedIds: number[]
  onToggle: (tag: TagOption) => void
  onCreateNew?: (name: string) => void
  placeholder?: string
  canCreate?: boolean

  // 新增：父标签双入口
  onToggleParentOnly?: (tag: TagOption) => void
  onToggleParentWithChildren?: (tag: TagOption) => void
}

type FlatItem =
  | { type: 'tag'; tag: TagOption; indent: number; isParent: boolean; parentId?: number }
  | { type: 'create'; name: string }

export default function TagSearchInput({
  options, selectedIds, onToggle, onCreateNew,
  placeholder = '搜索或新建标签…',
  canCreate = false,
  onToggleParentOnly,
  onToggleParentWithChildren,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    setHighlightIndex(-1)
  }, [query, open])

  const selectedTags = options.filter(t => selectedIds.includes(t.id))

  const isSearching = query.trim() !== ''
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = options.filter(t =>
    t.name.toLowerCase().includes(normalizedQuery) &&
    !selectedIds.includes(t.id)
  )

  const exactMatch = options.some(
    t => t.name.toLowerCase() === normalizedQuery
  )
  const showCreate = canCreate && query.trim() !== '' && !exactMatch

  const allChildrenMap = useMemo(() => {
    const map = new Map<number, TagOption[]>()
    for (const t of options) {
      if (t.parentId != null) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    return map
  }, [options])

  const globalParents = options.filter(
    t => t.isGlobal && !t.parentId && !selectedIds.includes(t.id)
  )
  const globalChildren = (parentId: number) =>
    (allChildrenMap.get(parentId) ?? []).filter(
      t => t.isGlobal && !selectedIds.includes(t.id)
    )

  const globalOrphans = options.filter(
    t => t.isGlobal && !t.parentId && !selectedIds.includes(t.id)
  )

  const privateOptions = options.filter(
    t => !t.isGlobal && !selectedIds.includes(t.id)
  )

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const flatItems: FlatItem[] = useMemo(() => {
    if (!open) return []

    if (isSearching) {
      const arr: FlatItem[] = filtered.map(tag => ({
        type: 'tag',
        tag,
        indent: 0,
        isParent: false,
      }))
      if (showCreate) arr.push({ type: 'create', name: query.trim() })
      return arr
    }

    const arr: FlatItem[] = []

    // 全局（树）
    for (const parent of globalParents) {
      const children = globalChildren(parent.id)
      arr.push({ type: 'tag', tag: parent, indent: 0, isParent: children.length > 0 })

      const isOpen = !collapsed.has(parent.id)
      if (isOpen) {
        for (const child of children) {
          arr.push({ type: 'tag', tag: child, indent: 1, isParent: false, parentId: parent.id })
        }
      }
    }

    // 通用/来源（平铺）
    const parentIdSet = new Set(options.filter(t => t.parentId != null).map(t => t.parentId as number))
    const orphanList = globalOrphans.filter(t => !parentIdSet.has(t.id))
    for (const t of orphanList) {
      arr.push({ type: 'tag', tag: t, indent: 0, isParent: false })
    }

    // 私有
    for (const t of privateOptions) {
      arr.push({ type: 'tag', tag: t, indent: 0, isParent: false })
    }

    return arr
  }, [open, isSearching, filtered, showCreate, query, globalParents, collapsed, options, globalOrphans, privateOptions])

  function performSelect(tag: TagOption, isParentRow = false) {
    if (isParentRow && onToggleParentOnly) onToggleParentOnly(tag)
    else onToggle(tag)
    setQuery('')
    setOpen(false)
    setHighlightIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flatItems.length === 0) return
      setHighlightIndex(prev => (prev + 1) % flatItems.length)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flatItems.length === 0) return
      setHighlightIndex(prev => (prev <= 0 ? flatItems.length - 1 : prev - 1))
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      setHighlightIndex(-1)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      const item = flatItems[highlightIndex]
      if (!item) {
        if (showCreate && onCreateNew) {
          onCreateNew(query.trim())
          setQuery('')
          setOpen(false)
          setHighlightIndex(-1)
        } else if (isSearching && filtered.length === 1) {
          performSelect(filtered[0], false)
        }
        return
      }

      if (item.type === 'create') {
        onCreateNew?.(item.name)
        setQuery('')
        setOpen(false)
        setHighlightIndex(-1)
        return
      }

      performSelect(item.tag, item.isParent)
      return
    }

    if (e.key === 'Backspace' && query === '' && selectedTags.length > 0) {
      onToggle(selectedTags[selectedTags.length - 1])
    }
  }

  const chipBase = (isGlobal: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
    background: isGlobal ? '#f5f5f5' : '#e6f4ff',
    color: isGlobal ? '#888' : '#1677ff',
    border: `1px solid ${isGlobal ? '#e0e0e0' : '#91caff'}`,
  })

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
  }

  function DropdownRow({
    tag, indent = 0, index, isParent = false, hasChildren = false,
  }: { tag: TagOption; indent?: number; index: number; isParent?: boolean; hasChildren?: boolean }) {
    const highlighted = index === highlightIndex
    const isCollapsed = collapsed.has(tag.id)

    return (
      <div
        style={{
          ...rowBase,
          paddingLeft: 12 + indent * 16,
          background: highlighted ? '#e6f4ff' : 'transparent',
          justifyContent: isParent ? 'space-between' : 'flex-start',
        }}
        onMouseEnter={() => setHighlightIndex(index)}
      >
        {!isParent ? (
          <div
            onMouseDown={() => performSelect(tag, false)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
          >
            <span style={chipBase(!!tag.isGlobal)}>
              {tag.isGlobal ? '全局' : '本库'}
            </span>
            {tag.name}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <button
                onMouseDown={e => {
                  e.stopPropagation()
                  performSelect(tag, true) // 仅选父
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 13,
                  color: '#333',
                }}
              >
                <span style={chipBase(!!tag.isGlobal)}>
                  {tag.isGlobal ? '全局' : '本库'}
                </span>
                <span style={{ fontWeight: 500 }}>{tag.name}</span>
              </button>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {hasChildren && onToggleParentWithChildren && (
                <button
                  onMouseDown={e => {
                    e.stopPropagation()
                    onToggleParentWithChildren(tag)
                    setQuery('')
                    setOpen(false)
                    setHighlightIndex(-1)
                  }}
                  title="父+子一起选择"
                  style={{
                    border: '1px solid #d9d9d9',
                    background: '#fff',
                    color: '#555',
                    borderRadius: 6,
                    fontSize: 11,
                    padding: '0 4px',
                    cursor: 'pointer',
                  }}
                >
                  +子
                </button>
              )}

              {hasChildren && (
                <button
                  onMouseDown={e => {
                    e.stopPropagation()
                    toggleCollapse(tag.id) // 仅展开/收起
                  }}
                  title={isCollapsed ? '展开子标签' : '收起子标签'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, color: '#aaa', padding: '0 4px',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                >
                  ▾
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 10 }}>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          gap: 4, padding: '4px 8px',
          border: '1px solid #d9d9d9', borderRadius: 8, cursor: 'text',
        }}
        onClick={() => wrapRef.current?.querySelector('input')?.focus()}
      >
        {selectedTags.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
            background: tag.isGlobal ? '#f5f5f5' : '#e6f4ff',
            color: tag.isGlobal ? '#666' : '#1677ff',
            border: `1px solid ${tag.isGlobal ? '#e0e0e0' : '#91caff'}`,
          }}>
            {tag.name}
            <button
              onMouseDown={e => { e.stopPropagation(); onToggle(tag) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, lineHeight: 1, fontSize: 13,
                color: tag.isGlobal ? '#aaa' : '#91caff',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
              onMouseLeave={e => (e.currentTarget.style.color = tag.isGlobal ? '#aaa' : '#91caff')}
            >
              ×
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          style={{
            flex: '1 1 80px', minWidth: 80,
            border: 'none', outline: 'none',
            fontSize: 13, padding: '2px 0', background: 'transparent',
          }}
        />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>
          {isSearching ? (
            <>
              {filtered.length === 0 && !showCreate && (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#aaa' }}>无匹配标签</div>
              )}

              {filtered.map(tag => {
                const idx = flatItems.findIndex(i => i.type === 'tag' && i.tag.id === tag.id)
                return <DropdownRow key={tag.id} tag={tag} index={idx} />
              })}

              {showCreate && (
                <div
                  onMouseDown={() => { onCreateNew?.(query.trim()); setQuery(''); setOpen(false); setHighlightIndex(-1) }}
                  onMouseEnter={() => {
                    const idx = flatItems.findIndex(i => i.type === 'create')
                    setHighlightIndex(idx)
                  }}
                  style={{
                    ...rowBase,
                    borderTop: filtered.length > 0 ? '1px dashed #eee' : 'none',
                    color: '#52c41a',
                    background: flatItems[highlightIndex]?.type === 'create' ? '#f6ffed' : 'transparent',
                  }}
                >
                  ＋ 新建标签「<b>{query.trim()}</b>」
                </div>
              )}
            </>
          ) : (
            <>
              {globalParents.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                  }}>
                    全局标签
                  </div>

                  {globalParents.map(parent => {
                    const children = globalChildren(parent.id)
                    const pIdx = flatItems.findIndex(i => i.type === 'tag' && i.tag.id === parent.id)

                    return (
                      <div key={parent.id}>
                        <DropdownRow
                          tag={parent}
                          index={pIdx}
                          isParent={children.length > 0}
                          hasChildren={children.length > 0}
                        />
                        {!collapsed.has(parent.id) && children.map(child => {
                          const cIdx = flatItems.findIndex(i => i.type === 'tag' && i.tag.id === child.id)
                          return (
                            <DropdownRow
                              key={child.id}
                              tag={child}
                              indent={1}
                              index={cIdx}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </>
              )}

              {globalOrphans.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                    borderTop: globalParents.length > 0 ? '1px solid #f0f0f0' : 'none',
                  }}>
                    通用 / 来源
                  </div>
                  {globalOrphans.map(tag => {
                    const idx = flatItems.findIndex(i => i.type === 'tag' && i.tag.id === tag.id)
                    return <DropdownRow key={tag.id} tag={tag} index={idx} />
                  })}
                </>
              )}

              {privateOptions.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                    borderTop: '1px solid #f0f0f0',
                  }}>
                    本库标签
                  </div>
                  {privateOptions.map(tag => {
                    const idx = flatItems.findIndex(i => i.type === 'tag' && i.tag.id === tag.id)
                    return <DropdownRow key={tag.id} tag={tag} index={idx} />
                  })}
                </>
              )}

              {globalParents.length === 0 && globalOrphans.length === 0 && privateOptions.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#aaa' }}>
                  输入关键词搜索或新建标签
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
