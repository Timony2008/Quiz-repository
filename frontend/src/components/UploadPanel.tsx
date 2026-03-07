import { useRef, useState } from 'react'
import api from '../api'

interface Props {
  quizSetId: number
  onClose: () => void
  onSuccess: () => void
}

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'failed'

export default function UploadPanel({ quizSetId, onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState<number | null>(null)

  const pollStatus = (sourceFileId: number) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/upload/status/${sourceFileId}`)
        const { status: s, quizCount, errorMsg } = res.data

        if (s === 'DONE') {
          clearInterval(interval)
          setStatus('done')
          setCount(quizCount)
          setMessage(`解析完成，共导入 ${quizCount} 道题`)
          onSuccess()
        } else if (s === 'FAILED') {
          clearInterval(interval)
          setStatus('failed')
          setMessage(errorMsg || '解析失败，请检查文件格式')
        }
      } catch {
        clearInterval(interval)
        setStatus('failed')
        setMessage('查询状态失败，请刷新页面')
      }
    }, 1500)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    setMessage('上传中...')
    setCount(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('quizSetId', String(quizSetId))

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus('processing')
      setMessage('文件已上传，正在解析...')
      pollStatus(res.data.sourceFileId)
    } catch (err: any) {
      setStatus('failed')
      setMessage(err.response?.data?.error || '上传失败')
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  const statusColor: Record<Status, string> = {
    idle: '#888',
    uploading: '#f0a500',
    processing: '#f0a500',
    done: '#27ae60',
    failed: '#c0392b'
  }

  return (
    <div style={{ marginTop: 12 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".tex,.pdf"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading' || status === 'processing'}
          style={{ fontSize: 13 }}
        >
          📎 上传题目文件（.tex / .pdf）
        </button>

        <button
          onClick={onClose}
          disabled={status === 'uploading' || status === 'processing'}
          style={{ fontSize: 13 }}
        >
          取消
        </button>
      </div>

      {status !== 'idle' && (
        <p style={{ marginTop: 8, fontSize: 13, color: statusColor[status] }}>
          {status === 'processing' && '⏳ '}
          {status === 'done' && '✅ '}
          {status === 'failed' && '❌ '}
          {message}
          {status === 'done' && count !== null && (
            <span style={{ marginLeft: 8, fontWeight: 'bold' }}>（共 {count} 道）</span>
          )}
        </p>
      )}

      <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
        支持格式：LaTeX（\begin&#123;question&#125;...&#125;）或 Q:/A: 纯文本
      </p>
    </div>
  )
}
