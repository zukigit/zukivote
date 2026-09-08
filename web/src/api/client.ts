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
  created_at: number
  voter_count: number
  item_count: number
}

export interface GetTopicsResponse {
  topics: Topic[]
}

export interface CreateTopicRequest {
  name: string
  start_at: number
  expired_at: number
  voter_count: number
}

export interface CreateTopicResponse {
  topic_id: string
  voters: string[]
}

export interface UpdateTopicRequest {
  name: string
  start_at: number
  expired_at: number
}

export interface UpdateTopicResponse {
  message: string
}

export interface DeleteTopicResponse {
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

export function getMe(): Promise<ApiResponse<User>> {
  return request<User>('/me')
}

export function getTopics(): Promise<ApiResponse<GetTopicsResponse>> {
  return request<GetTopicsResponse>('/topics')
}

export function createTopic(data: CreateTopicRequest): Promise<ApiResponse<CreateTopicResponse>> {
  return request<CreateTopicResponse>('/topics', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTopic(id: string, data: UpdateTopicRequest): Promise<ApiResponse<UpdateTopicResponse>> {
  return request<UpdateTopicResponse>(`/topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteTopic(id: string): Promise<ApiResponse<DeleteTopicResponse>> {
  return request<DeleteTopicResponse>(`/topics/${id}`, {
    method: 'DELETE',
  })
}

export interface GetVotersResponse {
  voters: string[]
}

export function getVoters(topicId: string): Promise<ApiResponse<GetVotersResponse>> {
  return request<GetVotersResponse>(`/voters?topic_id=${topicId}`)
}

export interface ItemValue {
  id: number
  key: string
  value: string
}

export interface Item {
  id: number
  description: string
  values: ItemValue[]
}

export interface GetItemsResponse {
  items: Item[]
}

export interface CreateItemRequest {
  topic_id: string
  description: string
  values?: Array<{ key: string; value: string }>
  photo: File
}

export interface CreateItemResponse {
  item_id: number
  photo_url: string
}

export interface DeleteItemResponse {
  message: string
}

export function getItems(topicId: string): Promise<ApiResponse<GetItemsResponse>> {
  return request<GetItemsResponse>(`/items?topic_id=${topicId}`)
}

export function createItem(data: CreateItemRequest): Promise<ApiResponse<CreateItemResponse>> {
  const formData = new FormData()
  formData.append('topic_id', data.topic_id)
  formData.append('description', data.description)
  if (data.values && data.values.length > 0) {
    formData.append('values', JSON.stringify(data.values))
  }
  formData.append('photo', data.photo)

  return request<CreateItemResponse>('/items', {
    method: 'POST',
    body: formData,
  })
}

export function deleteItem(id: number): Promise<ApiResponse<DeleteItemResponse>> {
  return request<DeleteItemResponse>(`/items/${id}`, {
    method: 'DELETE',
  })
}

export interface GetVotingResultsResponse {
  results: Record<number, number>
}

export function getVotingResults(topicId: string): Promise<ApiResponse<GetVotingResultsResponse>> {
  return request<GetVotingResultsResponse>(`/voting?topic_id=${topicId}`)
}

export interface VoteRequest {
  voter_id: string
  item_id: number
}

export interface VoteResponse {
  record_id: number
}

export function vote(data: VoteRequest): Promise<ApiResponse<VoteResponse>> {
  return request<VoteResponse>('/voting', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getPhotoUrl(itemId: number): string {
  return `${API_BASE}/photo?item_id=${itemId}`
}
