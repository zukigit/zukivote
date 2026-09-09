import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getVoters, createVoter } from '../api/client'
import { clearToken } from '../api/auth'
import './Voters.css'

function Voters() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [voters, setVoters] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [userName, setUserName] = useState('')
  const [newVoterId, setNewVoterId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVoters() {
      if (!topicId) {
        setLoading(false)
        return
      }

      const { data, error: apiError, status } = await getVoters(topicId)

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

      setVoters(data?.user_names ?? [])
      setLoading(false)
    }

    fetchVoters()
  }, [topicId, navigate])

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
    setUserName('')
    setLoading(false)

    const { data: votersData } = await getVoters(topicId)
    setVoters(votersData?.user_names ?? [])
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

  if (loading) {
    return (
      <div className="voters-page">
        <div className="voters-header">
          <button className="icon" onClick={() => navigate('/topics')}>←</button>
          <h1>Voters</h1>
        </div>
        <p className="voters-loading">Loading...</p>
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

      {error && !showModal && <p className="voters-error">{error}</p>}

      {voters.length === 0 ? (
        <p className="voters-empty">No voters found</p>
      ) : (
        <div className="voters-list">
          <div className="voter-item voter-header">
            <span className="voter-index">No</span>
            <span className="voter-name">UserName</span>
          </div>
          {voters.map((voter, index) => (
            <div key={index} className="voter-item">
              <span className="voter-index">{index + 1}</span>
              <span className="voter-name">{voter}</span>
            </div>
          ))}
        </div>
      )}

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
