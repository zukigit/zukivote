import { getToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const API_TIMEOUT = 5000

interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    ...options.headers,
  }

  const token = getToken()
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
  } catch {
    return { data: null, error: 'request timed out', status: 0 }
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await res.json()

  if (!res.ok) {
    return { data: null, error: body.error ?? 'something went wrong', status: res.status }
  }

  return { data: body as T, error: null, status: res.status }
}

export interface LoginRequest {
  user_name: string
  password: string
}

export interface LoginResponse {
  token: string
}

export interface SignupRequest {
  user_name: string
  password: string
}

export interface SignupResponse {
  message: string
}

export interface User {
  id: string
  user_name: string
}

export interface Topic {
  id: string
  name: string
  start_at: number
  expired_at: number
}

export interface GetTopicsResponse {
  topics: Topic[]
}

export function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function signup(data: SignupRequest): Promise<ApiResponse<SignupResponse>> {
  return request<SignupResponse>('/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getMe(): Promise<ApiResponse<User>> {
  return request<User>('/me')
}

export function getTopics(): Promise<ApiResponse<GetTopicsResponse>> {
  return request<GetTopicsResponse>('/topics')
}
