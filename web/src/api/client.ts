const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token')

  const headers: HeadersInit = {
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

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
