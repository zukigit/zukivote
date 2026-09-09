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
  const [showModal, setShowModal] = useState(false)
  const [userName, setUserName] = useState('')
  const [newVoterId, setNewVoterId] = useState<string | null>(null)

  function handleOpenModal() {
    setUserName('')
    setError('')
    setNewVoterId(null)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setUserName('')
    setError('')
    setNewVoterId(null)
  }

  async function handleAddVoter() {
    if (!topicId) {
      setError('Topic ID is required')
      return
    }

    if (!userName.trim()) {
      setError('User name is required')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: apiError, status } = await createVoter({ topic_id: topicId, user_name: userName.trim() })

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
        <button className="icon" onClick={handleOpenModal} title="Add Voter">+</button>
      </div>

      <div className="voters-content">
        <p>Click the + button to add a new voter to this topic.</p>
      </div>

      {showModal && (
        <div className="voter-modal-overlay" onClick={handleCloseModal}>
          <div className="voter-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Voter</h2>
            
            {error && <p className="voter-modal-error">{error}</p>}
            
            {newVoterId ? (
              <form onSubmit={(e) => { e.preventDefault(); handleOpenModal(); }}>
                <p className="voter-modal-success">Voter created successfully!</p>
                <p className="voter-id-label">Voter ID:</p>
                <p className="voter-id-value">{newVoterId}</p>
                <p className="voter-id-warning">Save this ID now. It will not be shown again.</p>
                <div className="voter-modal-actions">
                  <button type="button" className="voter-modal-cancel" onClick={handleCloseModal}>Close</button>
                  <button type="submit" className="voter-modal-submit">Add Another</button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleAddVoter(); }}>
                <label htmlFor="userName">User Name</label>
                <input
                  id="userName"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter voter name"
                  disabled={loading}
                  autoFocus
                />
                <div className="voter-modal-actions">
                  <button type="button" className="voter-modal-cancel" onClick={handleCloseModal}>Cancel</button>
                  <button type="submit" className="voter-modal-submit" disabled={loading}>
                    {loading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Voters
