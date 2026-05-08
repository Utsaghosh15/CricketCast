import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || ''

export const http = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export function unwrap(res) {
  return res.data?.data ?? res.data
}
