let token: string | null = null

export function getToken(): string | null {
  return token
}

export function setToken(t: string): void {
  token = t
}

export function clearToken(): void {
  token = null
}
