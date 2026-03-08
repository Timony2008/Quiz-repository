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
  const [dots, setDots] = useState('.')

  // 动态省略号动画
  const startDots = () => {
    let i = 0
    const timer = setInterval(() => {
      i = (i + 1) % 3
      setDots('.'.repeat(i + 1))
    }, 500)
    return timer
  }

  const pollStatus = (sourceFileId: number) => {
    const dotsTimer = startDots()

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/upload/status/${sourceFileId}`)
        const { status: s, quizCount, errorMsg } = res.data

        if (s === 'DONE') {
          clearInterval(interval)
          clearInterval(dotsTimer)
          setStatus('done')
          setCount(quizCount)
          setMessage(`解析完成，共导入 ${quizCount} 道题`)
          onSuccess()
        } else if (s === 'FAILED') {
          clearInterval(interval)
          clearInterval(dotsTimer)
          setStatus('failed')
          setMessage(errorMsg || '解析失败，请检查文件格式')
        }
      } catch {
        clearInterval(interval)
        clearInterval(dotsTimer)
        setStatus('failed')
        setMessage('查询状态失败，请刷新页面')
      }
    }, 1500)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    setMessage('上传中')
    setCount(null)
    const dotsTimer = startDots()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('quizSetId', String(quizSetId))

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      clearInterval(dotsTimer)
      setStatus('processing')
      setMessage('文件已上传，正在解析')
      pollStatus(res.data.sourceFileId)
    } catch (err: any) {
      clearInterval(dotsTimer)
      setStatus('failed')
      setMessage(err.response?.data?.error || '上传失败，请重试')
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  // 重置，允许重新上传
  const handleRetry = () => {
    setStatus('idle')
    setMessage('')
    setCount(null)
    setTimeout(() => inputRef.current?.click(), 50)
  }

  const isLoading = status === 'uploading' || status === 'processing'

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
          disabled={isLoading || status === 'done'}
          style={{
            fontSize: 13,
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? '⏳ 处理中...' : '📎 上传题目文件（.tex / .pdf）'}
        </button>

        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            fontSize: 13,
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          取消
        </button>
      </div>

      {/* 状态提示区 */}
      {status !== 'idle' && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          backgroundColor:
            status === 'failed' ? '#fff0f0' :
            status === 'done'   ? '#f0fff4' : '#fffbe6',
          border: `1px solid ${statusColor[status]}33`,
          color: statusColor[status],
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>
            {status === 'uploading'  && `⬆️ 上传中${dots}`}
            {status === 'processing' && `⚙️ 解析中${dots}`}
            {status === 'done'       && `✅ ${message}`}
            {status === 'failed'     && `❌ ${message}`}
          </span>

          {/* 失败时显示重试按钮 */}
          {status === 'failed' && (
            <button
              onClick={handleRetry}
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                padding: '2px 10px',
                color: '#c0392b',
                border: '1px solid #c0392b',
                borderRadius: 4,
                background: 'none',
                cursor: 'pointer'
              }}
            >
              重试
            </button>
          )}

          {status === 'done' && count !== null && (
            <span style={{ marginLeft: 4, fontWeight: 'bold' }}>（共 {count} 道）</span>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
        支持格式：LaTeX（\begin&#123;question&#125;...&#125;）或 Q:/A: 纯文本
      </p>
    </div>
  )
}
