// src/components/TagSearchInput.tsx
import { useState, useRef, useEffect } from 'react'

export interface TagOption {
  id: number
  name: string
  isGlobal?: boolean
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
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedTags = options.filter(t => selectedIds.includes(t.id))
  const filtered = options.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) &&
    !selectedIds.includes(t.id)
  )
  const exactMatch = options.some(
    t => t.name.toLowerCase() === query.trim().toLowerCase()
  )
  const showCreate = canCreate && query.trim() !== '' && !exactMatch

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 10 }}>

      {/* ── chip + 输入框同行 ──────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: 4, padding: '4px 8px',
        border: '1px solid #d9d9d9', borderRadius: 8,
        cursor: 'text',
        // 聚焦时由 input 的 onFocus 触发父容器高亮
      }}
        onClick={() => wrapRef.current?.querySelector('input')?.focus()}
      >
        {/* 已选 chip */}
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, padding: '2px 8px', borderRadius: 10,
              background: tag.isGlobal ? '#f5f5f5' : '#e6f4ff',
              color:      tag.isGlobal ? '#666'    : '#1677ff',
              border:     `1px solid ${tag.isGlobal ? '#e0e0e0' : '#91caff'}`,
              flexShrink: 0,
            }}
          >
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

        {/* 输入框：跟在 chip 后面，自动撑开剩余宽度 */}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={e => {
            setOpen(true)
            // 让外层容器显示蓝色边框
            const wrap = e.currentTarget.closest<HTMLDivElement>('.tag-input-wrap')
            if (wrap) wrap.style.borderColor = '#1677ff'
          }}
          onBlur={e => {
            const wrap = e.currentTarget.closest<HTMLDivElement>('.tag-input-wrap')
            if (wrap) wrap.style.borderColor = '#d9d9d9'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (filtered.length === 1) {
                onToggle(filtered[0]); setQuery('')
              } else if (showCreate && onCreateNew) {
                onCreateNew(query.trim()); setQuery(''); setOpen(false)
              }
            }
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            // Backspace 且输入框为空时，删除最后一个 chip
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

      {/* ── 下拉列表（位置不变）──────────────────────────── */}
      {open && (filtered.length > 0 || showCreate) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          marginTop: 4, maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(tag => (
            <div
              key={tag.id}
              onMouseDown={() => { onToggle(tag); setQuery(''); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                fontSize: 11, padding: '1px 6px', borderRadius: 8,
                background: tag.isGlobal ? '#f5f5f5' : '#e6f4ff',
                color:      tag.isGlobal ? '#888'    : '#1677ff',
                border:     `1px solid ${tag.isGlobal ? '#e0e0e0' : '#91caff'}`,
                flexShrink: 0,
              }}>
                {tag.isGlobal ? '全局' : '本库'}
              </span>
              {tag.name}
            </div>
          ))}

          {showCreate && (
            <div
              onMouseDown={() => { onCreateNew?.(query.trim()); setQuery(''); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                borderTop: filtered.length > 0 ? '1px dashed #eee' : 'none',
                color: '#52c41a',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f6ffed')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ＋ 新建标签「<b>{query.trim()}</b>」
            </div>
          )}
        </div>
      )}
    </div>
  )
}
