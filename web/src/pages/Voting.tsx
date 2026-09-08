import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getItems, getVotingResults, vote, getPhotoUrl, type Item } from '../api/client'
import { clearToken } from '../api/auth'
import './Voting.css'

type VoteStatus = 'idle' | 'submitting' | 'success' | 'failure'

function Voting() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [items, setItems] = useState<Item[]>([])
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lightboxItem, setLightboxItem] = useState<Item | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Vote modal state
  const [voteItem, setVoteItem] = useState<Item | null>(null)
  const [voterId, setVoterId] = useState('')
  const [voteStatus, setVoteStatus] = useState<VoteStatus>('idle')
  const [voteMessage, setVoteMessage] = useState('')

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleMenu(itemId: number) {
    setOpenMenuId(openMenuId === itemId ? null : itemId)
  }

  function openVoteModal(item: Item) {
    setVoteItem(item)
    setVoteStatus('idle')
    setVoteMessage('')
    setOpenMenuId(null)
  }

  function closeVoteModal() {
    setVoteItem(null)
    setVoteStatus('idle')
    setVoteMessage('')
  }

  async function handleVote() {
    if (!voteItem) return
    if (!voterId.trim()) {
      setVoteMessage('Please enter your Voter ID')
      return
    }

    setVoteStatus('submitting')
    setVoteMessage('')

    const { error: apiError } = await vote({
      voter_id: voterId.trim(),
      item_id: voteItem.id,
    })

    if (apiError) {
      setVoteStatus('failure')
      setVoteMessage(apiError)
      return
    }

    setVoteStatus('success')
    setVoteMessage('Vote recorded successfully')

    const votingResult = await getVotingResults(topicId!)
    if (votingResult.data) {
      setVoteCounts(votingResult.data.results)
    }
  }

  async function handleRefresh() {
    setLoading(true)
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
    setLoading(false)
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

      {items.length === 0 ? (
        <p className="voting-empty">No items found</p>
      ) : (
        <div className="voting-grid">
          {items.map((item) => (
            <div key={item.id} className="voting-card">
              <div className="voting-card-header">
                <div className="menu-container" ref={openMenuId === item.id ? menuRef : null}>
                  <button
                    className="menu-button"
                    onClick={() => toggleMenu(item.id)}
                    title="Menu"
                  >
                    ⋮
                  </button>
                  {openMenuId === item.id && (
                    <div className="menu-dropdown">
                      <button
                        className="menu-item"
                        onClick={() => openVoteModal(item)}
                      >
                        Vote
                      </button>
                    </div>
                  )}
                </div>
              </div>
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

      {voteItem && (
        <div className="vote-modal-overlay" onClick={closeVoteModal}>
          <div className="vote-modal" onClick={(e) => e.stopPropagation()}>
            {voteMessage && (
              <p className={`vote-message ${voteStatus === 'success' ? 'vote-success' : 'vote-failure'}`}>
                {voteMessage}
              </p>
            )}
            <div className="vote-modal-header">
              <h2>Vote for Item</h2>
              <button className="vote-modal-close" onClick={closeVoteModal}>×</button>
            </div>
            <div className="vote-modal-body">
              <p className="vote-item-name">{voteItem.description}</p>
              <label htmlFor="voterId">Your Voter ID:</label>
              <input
                id="voterId"
                type="text"
                value={voterId}
                onChange={(e) => setVoterId(e.target.value)}
                placeholder="Enter your voter UUID"
                className="vote-input"
                disabled={voteStatus === 'submitting'}
              />
            </div>
            <div className="vote-modal-footer">
              {voteStatus === 'idle' && (
                <button className="vote-submit-button" onClick={handleVote}>
                  Vote
                </button>
              )}
              {voteStatus === 'submitting' && (
                <button className="vote-submit-button" disabled>
                  Voting...
                </button>
              )}
              {voteStatus === 'success' && (
                <button className="vote-submit-button vote-done" onClick={closeVoteModal}>
                  Done
                </button>
              )}
              {voteStatus === 'failure' && (
                <button className="vote-submit-button vote-retry" onClick={handleVote}>
                  Retry
                </button>
              )}
            </div>
          </div>
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
