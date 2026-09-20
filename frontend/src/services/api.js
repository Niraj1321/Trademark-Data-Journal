import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
    ? 'https://trademark-data-journal-backend.onrender.com'
    : 'http://localhost:8000')

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Journals
export const getJournals = async (params = {}) => {
  const { data } = await api.get('/api/journals', { params })
  return data
}

export const getJournal = async (id) => {
  const { data } = await api.get(`/api/journals/${id}`)
  return data
}

export const getLatestJournals = async (count = 5) => {
  const { data } = await api.get('/api/journals/latest', { params: { count } })
  return data
}

export const getJournalTrademarks = async (id, params = {}) => {
  const { data } = await api.get(`/api/journals/${id}/trademarks`, { params })
  return data
}

export const deleteJournal = async (id) => {
  const { data } = await api.delete(`/api/journals/${id}`)
  return data
}

// Trademarks
export const getTrademarks = async (params = {}) => {
  const { data } = await api.get('/api/trademarks', { params })
  return data
}

export const getTrademark = async (id) => {
  const { data } = await api.get(`/api/trademarks/${id}`)
  return data
}

export const searchTrademarks = async (query, params = {}) => {
  const { data } = await api.get('/api/trademarks/search', {
    params: { q: query, ...params }
  })
  return data
}

// Scraper
export const triggerScraper = async () => {
  const { data } = await api.post('/api/scraper/run')
  return data
}

export const downloadPdfs = async () => {
  const { data } = await api.post('/api/scraper/download-pdfs')
  return data
}

export const extractPdfs = async () => {
  const { data } = await api.post('/api/scraper/extract-pdfs')
  return data
}

export const getScraperStatus = async () => {
  const { data } = await api.get('/api/scraper/status')
  return data
}

export const getScraperLogs = async (limit = 20) => {
  const { data } = await api.get('/api/scraper/logs', { params: { limit } })
  return data
}

export const cleanupAllData = async () => {
  const { data } = await api.delete('/api/scraper/cleanup')
  return data
}

// Statistics
export const getStatistics = async () => {
  const { data } = await api.get('/api/stats')
  return data
}

export default api
