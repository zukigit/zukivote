import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, type User } from '../api/client'
import { clearToken } from '../api/auth'

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMe().then(({ data, error: apiError, status }) => {
      if (apiError) {
        setError(apiError)
        if (status === 401) {
          clearToken()
          navigate('/login', { replace: true })
        }
        return
      }
      setUser(data)
    })
  }, [navigate])

  if (error) {
    return <p className="auth-error">{error}</p>
  }

  if (!user) {
    return <p>Loading...</p>
  }

  return (
    <div>
      <h1>Profile</h1>
      <div style={{ marginTop: '1rem' }}>
        <p><strong>User ID:</strong> {user.id}</p>
        <p><strong>Username:</strong> {user.user_name}</p>
      </div>
    </div>
  )
}

export default Profile
