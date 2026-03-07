import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api

export function updateVisibility(quizSetId: number, visibility: 'PRIVATE' | 'PUBLIC' | 'PUBLIC_EDIT') {
  return api.patch(`/quiz/${quizSetId}/visibility`, { visibility })
}
