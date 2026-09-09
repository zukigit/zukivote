import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createVoter } from '../api/client'
import { clearToken } from '../api/auth'
import './Voters.css'

function Voters() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [newVoterId, setNewVoterId] = useState<string | null>(null)

  async function handleAddVoter() {
    if (!topicId) {
      setError('Topic ID is required')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: apiError, status } = await createVoter({ topic_id: topicId })

    if (apiError) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      setError(apiError)
      setLoading(false)
      return
    }

    setNewVoterId(data?.voter_id ?? null)
    setLoading(false)
  }

  function handleCloseVoterId() {
    setNewVoterId(null)
  }

  if (!topicId) {
    return (
      <div className="voters-page">
        <div className="voters-header">
          <button className="icon" onClick={() => navigate('/topics')}>←</button>
          <h1>Voters</h1>
        </div>
        <p className="voters-error">Topic ID is required</p>
      </div>
    )
  }

  return (
    <div className="voters-page">
      <div className="voters-header">
        <button className="icon" onClick={() => navigate('/topics')}>←</button>
        <h1>Voters</h1>
        <button className="icon" onClick={handleAddVoter} disabled={loading} title="Add Voter">+</button>
      </div>

      {error && <p className="voters-error">{error}</p>}

      <div className="voters-content">
        <p>Click the + button to add a new voter to this topic.</p>
      </div>

      {newVoterId && (
        <div className="voter-id-overlay" onClick={handleCloseVoterId}>
          <div className="voter-id-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Voter Created</h2>
            <p className="voter-id-label">Voter ID:</p>
            <p className="voter-id-value">{newVoterId}</p>
            <p className="voter-id-warning">Save this ID now. It will not be shown again.</p>
            <button className="voter-id-close" onClick={handleCloseVoterId}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Voters
