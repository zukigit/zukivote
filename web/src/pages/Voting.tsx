import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getTopicById,
  getItems,
  getVotingResults,
  vote,
  getPhotoUrl,
  type Item,
} from '../api/client'
import { getToken } from '../api/auth'
import Sidebar from '../components/Sidebar'
import './Voting.css'

type VoteStatus = 'idle' | 'submitting' | 'success' | 'failure'
type VotingStatus = 'not-started' | 'active' | 'ended'

function getVotingStatus(startAt: number, expiredAt: number): VotingStatus | null {
  if (startAt === 0 || expiredAt === 0) return null
  const now = Math.floor(Date.now() / 1000)
  if (now < startAt) return 'not-started'
  if (now >= expiredAt) return 'ended'
  return 'active'
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return date.toLocaleString(undefined, {
    hour12: false,
    timeZone: tz,
  }) + `, ${tz}`
}

function Voting() {
  const navigate = useNavigate()
  const { topicId } = useParams<{ topicId: string }>()
  const isAuthenticated = !!getToken()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [topicName, setTopicName] = useState('')
  const [startAt, setStartAt] = useState(0)
  const [expiredAt, setExpiredAt] = useState(0)
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

  // Auto refresh state
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5)

  // Countdown state
  const [showCountdown, setShowCountdown] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const votingStatus = getVotingStatus(startAt, expiredAt)

  async function fetchData() {
    if (!topicId) {
      setError('Topic ID is required')
      setLoading(false)
      return
    }

    const [topicResult, itemsResult, votingResult] = await Promise.all([
      getTopicById(topicId),
      getItems(topicId),
      getVotingResults(topicId),
    ])

    if (topicResult.error) {
      setError(topicResult.error)
      setLoading(false)
      return
    }

    if (itemsResult.error) {
      setError(itemsResult.error)
      setLoading(false)
      return
    }

    if (votingResult.error) {
      setError(votingResult.error)
      setLoading(false)
      return
    }

    if (topicResult.data) {
      setTopicName(topicResult.data.name)
      setStartAt(topicResult.data.start_at)
      setExpiredAt(topicResult.data.expired_at)
    }

    setItems(itemsResult.data?.items ?? [])
    setVoteCounts(votingResult.data?.results ?? {})
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [topicId])

  useEffect(() => {
    if (!autoRefresh || votingStatus !== 'active') return

    const intervalId = setInterval(() => {
      fetchData()

      // Check if we're within 1 minute of voting ending
      if (expiredAt > 0) {
        const now = Math.floor(Date.now() / 1000)
        const remaining = expiredAt - now
        if (remaining > 0 && remaining <= 60) {
          setShowCountdown(true)
          setRemainingSeconds(remaining)
        }
      }
    }, refreshInterval * 1000)

    return () => clearInterval(intervalId)
  }, [autoRefresh, refreshInterval, votingStatus, topicId, expiredAt])

  useEffect(() => {
    if (!showCountdown) return

    const countdownId = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = expiredAt - now
      if (remaining <= 0) {
        setRemainingSeconds(0)
        clearInterval(countdownId)
      } else {
        setRemainingSeconds(remaining)
      }
    }, 1000)

    return () => clearInterval(countdownId)
  }, [showCountdown, expiredAt])

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

    const [topicResult, itemsResult, votingResult] = await Promise.all([
      getTopicById(topicId!),
      getItems(topicId!),
      getVotingResults(topicId!),
    ])

    if (topicResult.error) {
      setError(topicResult.error)
      setLoading(false)
      return
    }

    if (itemsResult.error) {
      setError(itemsResult.error)
      setLoading(false)
      return
    }

    if (votingResult.error) {
      setError(votingResult.error)
      setLoading(false)
      return
    }

    if (topicResult.data) {
      setTopicName(topicResult.data.name)
      setStartAt(topicResult.data.start_at)
      setExpiredAt(topicResult.data.expired_at)
    }

    setItems(itemsResult.data?.items ?? [])
    setVoteCounts(votingResult.data?.results ?? {})
    setLoading(false)
  }

  if (loading) {
    const content = (
      <div className={`voting-page${!isAuthenticated ? ' voting-page-standalone' : ''}`}>
        <div className="voting-header">
          {isAuthenticated && <button className="icon" onClick={() => navigate(-1)}>←</button>}
          <button className="icon" onClick={handleRefresh} title="Refresh" disabled>↻</button>
          <h1>Loading...</h1>
        </div>
      </div>
    )

    if (isAuthenticated) {
      return (
        <div className="layout">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="main-content">{content}</main>
        </div>
      )
    }

    return content
  }

  const content = (
    <div className={`voting-page${!isAuthenticated ? ' voting-page-standalone' : ''}`}>
      <div className="voting-header">
        {isAuthenticated && <button className="icon" onClick={() => navigate(-1)}>←</button>}
        <button className="icon" onClick={handleRefresh} title="Refresh" disabled={loading}>↻</button>
        <div className="auto-refresh-controls">
          <button
            className={`icon auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Disable auto refresh' : 'Enable auto refresh'}
          >
            {autoRefresh ? '⏸' : '▶'}
          </button>
          {autoRefresh && (
            <div className="interval-controls">
              <button
                className="icon interval-btn"
                onClick={() => setRefreshInterval(Math.max(5, refreshInterval - 1))}
                title="Decrease interval"
              >
                -
              </button>
              <span className="interval-value">{refreshInterval}s</span>
              <button
                className="icon interval-btn"
                onClick={() => setRefreshInterval(refreshInterval + 1)}
                title="Increase interval"
              >
                +
              </button>
            </div>
          )}
        </div>
        <h1>Voting</h1>
      </div>

      {error && <p className="voting-error">{error}</p>}

      {votingStatus && (
        <div className={`voting-status voting-status-${votingStatus}`}>
          {votingStatus === 'not-started' && (
            <span className="voting-status-label">Not started yet, will start at {formatTimestamp(startAt)}</span>
          )}
          {votingStatus === 'active' && (
            <span className="voting-status-label">Started, will end at {formatTimestamp(expiredAt)}</span>
          )}
          {votingStatus === 'ended' && (
            <span className="voting-status-label">Ended at {formatTimestamp(expiredAt)}</span>
          )}
        </div>
      )}

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

      {showCountdown && (
        <div className="countdown-overlay">
          <div className="countdown-modal">
            <h2>Voting Ending Soon!</h2>
            <p className="countdown-message">Voting will end in:</p>
            <p className="countdown-timer">{remainingSeconds}s</p>
            <button className="countdown-close" onClick={() => setShowCountdown(false)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )

  if (isAuthenticated) {
    return (
      <div className="layout">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">{content}</main>
      </div>
    )
  }

  return content
}

export default Voting
