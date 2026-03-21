import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React from 'react'  
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import QuizSetDetail from './pages/QuizSetDetail'  // ← 加这行
import GlobalTagManager from './pages/GlobalTagManager'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('token') ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/quiz/:id" element={<PrivateRoute><QuizSetDetail /></PrivateRoute>} />
        <Route path="/tags" element={<PrivateRoute><GlobalTagManager /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
