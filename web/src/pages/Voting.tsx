import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getItems, getVotingResults, getPhotoUrl, type Item } from '../api/client'
import { clearToken } from '../api/auth'
import './Voting.css'

function Voting() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [items, setItems] = useState<Item[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [lightboxItem, setLightboxItem] = useState<Item | null>(null)

  async function fetchData() {
    if (!topicId) {
      setError('Topic ID is required')
      setLoading(false)
      return
    }

    const [itemsResult, votingResult] = await Promise.all([
      getItems(topicId),
      getVotingResults(topicId),
    ])

    if (itemsResult.error) {
      setError(itemsResult.error)
      if (itemsResult.status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      setLoading(false)
      return
    }

    if (votingResult.error) {
      setError(votingResult.error)
      setLoading(false)
      return
    }

    setItems(itemsResult.data?.items ?? [])
    setVoteCounts(votingResult.data?.results ?? {})
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [topicId])

  async function handleRefresh() {
    setLoading(true)
    setMessage('')
    setError('')

    const [itemsResult, votingResult] = await Promise.all([
      getItems(topicId!),
      getVotingResults(topicId!),
    ])

    if (itemsResult.error) {
      setError(itemsResult.error)
      if (itemsResult.status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      setLoading(false)
      return
    }

    if (votingResult.error) {
      setError(votingResult.error)
      setLoading(false)
      return
    }

    setItems(itemsResult.data?.items ?? [])
    setVoteCounts(votingResult.data?.results ?? {})
    setMessage('Data updated')
    setLoading(false)

    setTimeout(() => setMessage(''), 2000)
  }

  if (loading) {
    return (
      <div className="voting-page">
        <div className="voting-header">
          <button className="icon" onClick={() => navigate('/topics')}>←</button>
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="voting-page">
      <div className="voting-header">
        <button className="icon" onClick={() => navigate('/topics')}>←</button>
        <h1>Voting Results</h1>
        <button className="icon" onClick={handleRefresh} title="Refresh" disabled={loading}>↻</button>
      </div>

      {error && <p className="voting-error">{error}</p>}
      {message && <p className="voting-message">{message}</p>}

      {items.length === 0 ? (
        <p className="voting-empty">No items found</p>
      ) : (
        <div className="voting-grid">
          {items.map((item) => (
            <div key={item.id} className="voting-card">
              <div className="voting-photo" onClick={() => setLightboxItem(item)}>
                <img
                  src={getPhotoUrl(item.id)}
                  alt={item.description}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="voting-details">
                <h3 className="voting-description">{item.description}</h3>
                <div className="voting-count">
                  <span className="vote-number">{voteCounts[item.id] ?? 0}</span>
                  <span className="vote-label">votes</span>
                </div>
                {item.values.length > 0 && (
                  <div className="voting-values">
                    {item.values.map((value) => (
                      <div key={value.id} className="voting-value">
                        <span className="value-key">{value.key}:</span>
                        <span className="value-value">{value.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxItem && (
        <div className="lightbox" onClick={() => setLightboxItem(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxItem(null)}>×</button>
            <img
              src={getPhotoUrl(lightboxItem.id)}
              alt={lightboxItem.description}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Voting
