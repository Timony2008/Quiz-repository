// src/components/TagSearchInput.tsx
import { useState, useRef, useEffect } from 'react'

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
}

export default function TagSearchInput({
  options, selectedIds, onToggle, onCreateNew,
  placeholder = '搜索或新建标签…',
  canCreate = false,
}: Props) {
  const [query, setQuery]           = useState('')
  const [open, setOpen]             = useState(false)
  const [collapsed, setCollapsed]   = useState<Set<number>>(new Set())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedTags = options.filter(t => selectedIds.includes(t.id))

  // ── 搜索模式：平铺过滤 ──────────────────────────────────────
  const isSearching = query.trim() !== ''
  const filtered = options.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) &&
    !selectedIds.includes(t.id)
  )
  const exactMatch = options.some(
    t => t.name.toLowerCase() === query.trim().toLowerCase()
  )
  const showCreate = canCreate && query.trim() !== '' && !exactMatch

  // ── 浏览模式：树形结构 ──────────────────────────────────────
  // 全局父标签（isGlobal=true, parentId=null）
  const globalParents = options.filter(
    t => t.isGlobal && !t.parentId && !selectedIds.includes(t.id)
  )
  // 全局子标签 map
  const globalChildren = (parentId: number) =>
    options.filter(
      t => t.isGlobal && t.parentId === parentId && !selectedIds.includes(t.id)
    )
  // 无父标签的全局标签（来源标签、通用方法等）
  const globalOrphans = options.filter(
    t => t.isGlobal && !t.parentId
      && !globalParents.find(p => p.id === t.id)
      && !selectedIds.includes(t.id)
  )
  // 本库私有标签
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

  // ── 样式常量 ────────────────────────────────────────────────
  const chipBase = (isGlobal: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
    background: isGlobal ? '#f5f5f5' : '#e6f4ff',
    color:      isGlobal ? '#888'    : '#1677ff',
    border:     `1px solid ${isGlobal ? '#e0e0e0' : '#91caff'}`,
  })

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
  }

  function DropdownRow({
    tag, indent = 0,
  }: { tag: TagOption; indent?: number }) {
    return (
      <div
        onMouseDown={() => { onToggle(tag); setQuery(''); setOpen(false) }}
        style={{ ...rowBase, paddingLeft: 12 + indent * 16 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={chipBase(!!tag.isGlobal)}>
          {tag.isGlobal ? '全局' : '本库'}
        </span>
        {tag.name}
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 10 }}>

      {/* ── chip + 输入框同行 ──────────────────────────────── */}
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
            color:      tag.isGlobal ? '#666'    : '#1677ff',
            border:     `1px solid ${tag.isGlobal ? '#e0e0e0' : '#91caff'}`,
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
            >×</button>
          </span>
        ))}

        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (isSearching && filtered.length === 1) {
                onToggle(filtered[0]); setQuery('')
              } else if (showCreate && onCreateNew) {
                onCreateNew(query.trim()); setQuery(''); setOpen(false)
              }
            }
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Backspace' && query === '' && selectedTags.length > 0) {
              onToggle(selectedTags[selectedTags.length - 1])
            }
          }}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          style={{
            flex: '1 1 80px', minWidth: 80,
            border: 'none', outline: 'none',
            fontSize: 13, padding: '2px 0', background: 'transparent',
          }}
        />
      </div>

      {/* ── 下拉列表 ──────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
        }}>

          {/* ── 搜索模式：平铺结果 ── */}
          {isSearching ? (
            <>
              {filtered.length === 0 && !showCreate && (
                <div style={{ padding: '10px 12px', fontSize: 13, color: '#aaa' }}>无匹配标签</div>
              )}
              {filtered.map(tag => <DropdownRow key={tag.id} tag={tag} />)}
              {showCreate && (
                <div
                  onMouseDown={() => { onCreateNew?.(query.trim()); setQuery(''); setOpen(false) }}
                  style={{
                    ...rowBase,
                    borderTop: filtered.length > 0 ? '1px dashed #eee' : 'none',
                    color: '#52c41a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f6ffed')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  ＋ 新建标签「<b>{query.trim()}</b>」
                </div>
              )}
            </>
          ) : (
            /* ── 浏览模式：树形 ── */
            <>
              {/* 全局标签（有层级的） */}
              {globalParents.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                  }}>全局标签</div>

                  {globalParents.map(parent => {
                    const children = globalChildren(parent.id)
                    const isOpen   = !collapsed.has(parent.id)
                    return (
                      <div key={parent.id}>
                        {/* 父标签行 */}
                        <div
                          style={{
                            ...rowBase,
                            justifyContent: 'space-between',
                            background: 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* 左侧：点击选中父标签 */}
                          <div
                            onMouseDown={() => { onToggle(parent); setOpen(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}
                          >
                            <span style={chipBase(true)}>全局</span>
                            <span style={{ fontWeight: 500 }}>{parent.name}</span>
                          </div>
                          {/* 右侧：折叠按钮（有子标签才显示） */}
                          {children.length > 0 && (
                            <button
                              onMouseDown={e => { e.stopPropagation(); toggleCollapse(parent.id) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 11, color: '#aaa', padding: '0 4px',
                                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.15s',
                              }}
                            >▾</button>
                          )}
                        </div>

                        {/* 子标签行（缩进） */}
                        {isOpen && children.map(child => (
                          <DropdownRow key={child.id} tag={child} indent={1} />
                        ))}
                      </div>
                    )
                  })}
                </>
              )}

              {/* 无父标签的全局标签（IMO、数学归纳法等） */}
              {globalOrphans.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                    borderTop: globalParents.length > 0 ? '1px solid #f0f0f0' : 'none',
                  }}>通用 / 来源</div>
                  {globalOrphans.map(tag => <DropdownRow key={tag.id} tag={tag} />)}
                </>
              )}

              {/* 本库私有标签 */}
              {privateOptions.length > 0 && (
                <>
                  <div style={{
                    padding: '5px 12px 3px', fontSize: 11,
                    color: '#aaa', letterSpacing: 1,
                    borderTop: '1px solid #f0f0f0',
                  }}>本库标签</div>
                  {privateOptions.map(tag => <DropdownRow key={tag.id} tag={tag} />)}
                </>
              )}

              {/* 全部为空 */}
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
