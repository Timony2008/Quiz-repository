import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/auth/register', { username, password })
      navigate('/login')
    } catch {
      setError('注册失败，用户名可能已存在')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f5f7fa'
    }}>
      <div style={{
        width: 360, background: '#fff', borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px 36px'
      }}>
        <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>注册</h2>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>用户名</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>密码</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              style={{ width: '100%' }}
            />
          </div>

          {error && <div style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button type="submit" style={{
            width: '100%', padding: '9px 0', background: '#1677ff',
            color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 15, fontWeight: 600, cursor: 'pointer'
          }}>
            注册
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, color: '#888', textAlign: 'center' }}>
          已有账号？<Link to="/login">登录</Link>
        </div>
      </div>
    </div>
  )
}
