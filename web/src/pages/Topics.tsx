import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopics, deleteTopic, getVoters, type Topic } from '../api/client'
import { clearToken } from '../api/auth'
import './Topics.css'
import '../styles/icons.css'

function Topics() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchTopics() {
      setLoading(true)
      const { data, error: apiError, status } = await getTopics()

      if (apiError) {
        setError(apiError)
        if (status === 401) {
          clearToken()
          navigate('/login', { replace: true })
        }
        setLoading(false)
        return
      }

      setTopics(data?.topics ?? [])
      setLoading(false)
    }

    fetchTopics()
  }, [navigate])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleMenu(topicId: string) {
    setOpenMenuId(openMenuId === topicId ? null : topicId)
  }

  async function handleDelete(topicId: string, topicName: string) {
    if (!window.confirm(`Are you sure you want to delete "${topicName}"?`)) {
      return
    }

    const { error, status } = await deleteTopic(topicId)

    if (error) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      setMessage('')
      setError(error)
      return
    }

    setError('')
    setTopics(topics.filter((t) => t.id !== topicId))
    setMessage('Topic deleted')
    setTimeout(() => setMessage(''), 2000)
  }

  async function handleDownloadVoters(topicId: string, topicName: string) {
    const { data, error: apiError, status } = await getVoters(topicId)

    if (apiError) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      setError(apiError)
      return
    }

    const content = data?.voters.join('\n') ?? ''
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${topicName}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRefresh() {
    setLoading(true)
    setError('')
    setMessage('')
    const { data, error: apiError, status } = await getTopics()

    if (apiError) {
      setError(apiError)
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      setLoading(false)
      return
    }

    const newTopics = data?.topics ?? []
    if (JSON.stringify(newTopics) === JSON.stringify(topics)) {
      setMessage('No updates')
    } else {
      setMessage('Data updated')
    }
    setTopics(newTopics)
    setLoading(false)

    setTimeout(() => setMessage(''), 2000)
  }

  function formatTimestamp(timestamp: number) {
    const date = new Date(timestamp * 1000)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return date.toLocaleString(undefined, {
      hour12: false,
      timeZone: tz,
    }) + `, ${tz}`
  }

  if (loading) {
    return (
      <div className="topics-page">
        <div className="topics-header">
          <button className="icon" onClick={() => navigate('/topics/create')} title="Add Topic">+</button>
          <h1>Loading...</h1>
          <button className="icon" onClick={handleRefresh} title="Refresh" disabled={loading}>↻</button>
        </div>
      </div>
    )
  }

  return (
    <div className="topics-page">
      <div className="topics-header">
        <button className="icon" onClick={() => navigate('/topics/create')} title="Add Topic">+</button>
        <h1>Topics</h1>
        <button className="icon" onClick={handleRefresh} title="Refresh" disabled={loading}>↻</button>
      </div>

      {error && <p className="topics-error">{error}</p>}
      {message && <p className={message === 'No updates' ? 'topics-info' : 'topics-message'}>{message}</p>}

      <table className="topics-table">
        <thead>
          <tr>
            <th className="col-menu"></th>
            <th>#</th>
            <th className="col-name">Name</th>
            <th>Voter Count</th>
            <th>Item Count</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Created Time</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, index) => (
            <tr key={topic.id}>
              <td className="col-menu">
                <div className="menu-container" ref={openMenuId === topic.id ? menuRef : null}>
                  <button
                    className="menu-button"
                    onClick={() => toggleMenu(topic.id)}
                    title="Menu"
                  >
                    ⋮
                  </button>
                  {openMenuId === topic.id && (
                    <div className="menu-dropdown">
                      <button
                        className="menu-item"
                        onClick={() => {
                          navigate(`/topics/${topic.id}/voting`)
                          setOpenMenuId(null)
                        }}
                      >
                        Voting
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          navigate(`/topics/edit/${topic.id}`)
                          setOpenMenuId(null)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          navigate('/items', { state: { topicId: topic.id } })
                          setOpenMenuId(null)
                        }}
                      >
                        Items
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          handleDownloadVoters(topic.id, topic.name)
                          setOpenMenuId(null)
                        }}
                      >
                        Get Voter IDs
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          const link = `${window.location.origin}/voting/${topic.id}`
                          navigator.clipboard.writeText(link)
                          setMessage(`Link copied: ${link}`)
                          setTimeout(() => setMessage(''), 5000)
                          setOpenMenuId(null)
                        }}
                      >
                        Get Voting Link
                      </button>
                      <button
                        className="menu-item menu-item-delete"
                        onClick={() => {
                          handleDelete(topic.id, topic.name)
                          setOpenMenuId(null)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td>{index + 1}</td>
              <td className="col-name">{topic.name}</td>
              <td>{topic.voter_count}</td>
              <td>{topic.item_count}</td>
              <td>{formatTimestamp(topic.start_at)}</td>
              <td>{formatTimestamp(topic.expired_at)}</td>
              <td>{formatTimestamp(topic.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Topics
