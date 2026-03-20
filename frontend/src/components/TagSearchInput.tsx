// src/components/TagSearchInput.tsx
// 通用标签搜索输入组件
// - 实时搜索已有标签（本库 + 全局）
// - 下拉区分全局（灰）/ 私有（蓝）
// - 选中后以 chip 展示，点 × 删除
// - 输入不匹配任何标签时，显示「新建」选项
import { useState, useRef, useEffect } from 'react'

export interface TagOption {
  id: number
  name: string
  isGlobal?: boolean
}

interface Props {
  // 所有可选标签（本库 + 全局合并，已去重）
  options: TagOption[]
  // 当前已选中的标签 id 列表
  selectedIds: number[]
  // 选中 / 取消选中某个已有标签
  onToggle: (tag: TagOption) => void
  // 用户输入了一个不存在的名字，要求新建
  onCreateNew?: (name: string) => void
  placeholder?: string
  // 是否允许新建标签（作者才有权限）
  canCreate?: boolean
}

export default function TagSearchInput({
  options, selectedIds, onToggle, onCreateNew,
  placeholder = '搜索或新建标签…',
  canCreate = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 点击组件外部时关闭下拉
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

  // 已选标签对象列表（用于渲染 chip）
  const selectedTags = options.filter(t => selectedIds.includes(t.id))

  // 过滤逻辑：名字包含 query（不区分大小写），且未选中
  const filtered = options.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) &&
    !selectedIds.includes(t.id)
  )

  // 是否显示「新建」选项：有输入 + 无完全匹配 + 有权限
  const exactMatch = options.some(
    t => t.name.toLowerCase() === query.trim().toLowerCase()
  )
  const showCreate = canCreate && query.trim() !== '' && !exactMatch

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>

      {/* ── 已选 chip 行 ──────────────────────────────────── */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {selectedTags.map(tag => (
            <span
              key={tag.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 12, padding: '2px 8px', borderRadius: 10,
                background: tag.isGlobal ? '#f5f5f5' : '#e6f4ff',
                color:      tag.isGlobal ? '#666'    : '#1677ff',
                border:     `1px solid ${tag.isGlobal ? '#e0e0e0' : '#91caff'}`,
              }}
            >
              {tag.name}
              <button
                onClick={() => onToggle(tag)}
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
        </div>
      )}

      {/* ── 搜索输入框 ────────────────────────────────────── */}
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          // Enter 且只有一个候选 → 直接选中
          if (e.key === 'Enter') {
            if (filtered.length === 1) {
              onToggle(filtered[0])
              setQuery('')
            } else if (showCreate && onCreateNew) {
              onCreateNew(query.trim())
              setQuery('')
              setOpen(false)
            }
          }
          if (e.key === 'Escape') { setOpen(false); setQuery('') }
        }}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '5px 10px', fontSize: 13,
          borderRadius: 8, border: '1px solid #d9d9d9',
          outline: 'none', boxSizing: 'border-box',
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = '#1677ff')}
        onBlurCapture={e  => (e.currentTarget.style.borderColor = '#d9d9d9')}
      />

      {/* ── 下拉列表 ──────────────────────────────────────── */}
      {open && (filtered.length > 0 || showCreate) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          marginTop: 4, maxHeight: 220, overflowY: 'auto',
        }}>

          {/* 已有标签列表 */}
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
              {/* 全局 / 私有标签视觉区分 */}
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

          {/* 新建选项（虚线分隔） */}
          {showCreate && (
            <div
              onMouseDown={() => {
                onCreateNew?.(query.trim())
                setQuery('')
                setOpen(false)
              }}
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
