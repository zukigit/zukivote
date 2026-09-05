import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopics, type Topic } from '../api/client'
import { clearToken } from '../api/auth'
import './Topics.css'
import '../styles/icons.css'

function Topics() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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

  async function handleRefresh() {
    setLoading(true)
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
            <th>#</th>
            <th>Name</th>
            <th>Created</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, index) => (
            <tr key={topic.id}>
              <td>{index + 1}</td>
              <td>{topic.name}</td>
              <td>{formatTimestamp(topic.created_at)}</td>
              <td>{formatTimestamp(topic.start_at)}</td>
              <td>{formatTimestamp(topic.expired_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Topics
