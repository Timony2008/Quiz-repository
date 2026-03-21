// src/pages/GlobalTagManager.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface TagNode {
  id: number
  name: string
  parentId: number | null
  children: TagNode[]
  quizCount: number
}

export default function GlobalTagManager() {
  const navigate = useNavigate()
  const [tree, setTree]           = useState<TagNode[]>([])
  const [newName, setNewName]     = useState('')
  const [newParent, setNewParent] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [error, setError]         = useState('')

  useEffect(() => { fetchTree() }, [])

  async function fetchTree() {
    const res = await api.get('/tag/tree')
    setTree(res.data)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setError('')
    try {
      await api.post('/tag', {
        name,
        isGlobal: true,
        parentId: newParent ?? null,
        quizSetId: null,
      })
      setNewName('')
      setNewParent(null)
      fetchTree()
    } catch (e: any) {
      setError(e.response?.data?.error ?? '创建失败')
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`删除标签「${name}」？其子标签也会一并删除。`)) return
    await api.delete(`/tag/${id}`)
    fetchTree()
  }

  async function handleEditSave(id: number) {
    const name = editName.trim()
    if (!name) return
    await api.patch(`/tag/${id}`, { name })
    setEditingId(null)
    fetchTree()
  }

  // 平铺所有全局标签，用于父标签选择下拉
  function flatten(nodes: TagNode[]): TagNode[] {
    return nodes.flatMap(n => [n, ...flatten(n.children)])
  }
  const allFlat = flatten(tree)

  function renderNode(node: TagNode, depth = 0) {
    const isEditing = editingId === node.id
    return (
      <div key={node.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          paddingLeft: 12 + depth * 20,
          borderBottom: '1px solid #f5f5f5',
          background: depth === 0 ? '#fafafa' : '#fff',
        }}>
          {isEditing ? (
            <>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditSave(node.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                style={{
                  flex: 1, padding: '3px 8px', borderRadius: 6,
                  border: '1px solid #91caff', fontSize: 13,
                }}
              />
              <button
                onClick={() => handleEditSave(node.id)}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6,
                  background: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer' }}
              >保存</button>
              <button
                onClick={() => setEditingId(null)}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6,
                  background: '#f0f0f0', color: '#555', border: 'none', cursor: 'pointer' }}
              >取消</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 14, fontWeight: depth === 0 ? 600 : 400 }}>
                {'　'.repeat(depth)}{depth > 0 ? '└ ' : ''}{node.name}
              </span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{node.quizCount} 题</span>
              <button
                onClick={() => { setEditingId(node.id); setEditName(node.name) }}
                style={{ fontSize: 12, color: '#1677ff', background: 'none',
                  border: 'none', cursor: 'pointer' }}
              >编辑</button>
              <button
                onClick={() => handleDelete(node.id, node.name)}
                style={{ fontSize: 12, color: '#ff4d4f', background: 'none',
                  border: 'none', cursor: 'pointer' }}
              >删除</button>
            </>
          )}
        </div>
        {node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 40px' }}>

      {/* 顶栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 20, borderBottom: '1px solid #f0f0f0', marginBottom: 24,
      }}>
        <h2 style={{ margin: 0 }}>🏷️ 全局标签管理</h2>
        <button
          onClick={() => navigate('/')}
          style={{ fontSize: 13, padding: '5px 14px', borderRadius: 6,
            background: '#f5f5f5', border: '1px solid #e0e0e0', cursor: 'pointer' }}
        >← 返回题库</button>
      </div>

      {/* 新建标签 */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        marginBottom: 24, padding: 16,
        background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee',
      }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="新标签名称…"
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 6,
            border: '1px solid #d9d9d9', fontSize: 13,
          }}
        />
        <select
          value={newParent ?? ''}
          onChange={e => setNewParent(e.target.value ? Number(e.target.value) : null)}
          style={{
            padding: '6px 10px', borderRadius: 6,
            border: '1px solid #d9d9d9', fontSize: 13, color: newParent ? '#333' : '#aaa',
          }}
        >
          <option value="">无父标签（顶级）</option>
          {allFlat.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13,
            background: '#1677ff', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >＋ 创建</button>
      </div>

      {error && (
        <div style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      {/* 标签树 */}
      <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
        {tree.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            还没有全局标签，从上方创建第一个吧
          </div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>

    </div>
  )
}
