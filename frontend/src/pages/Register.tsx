import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', { username, password })
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h2>注册</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>用户名<br />
            <input value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>密码<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? '注册中...' : '注册'}</button>
      </form>
      <p>已有账号？<Link to="/login">登录</Link></p>
    </div>
  )
}
