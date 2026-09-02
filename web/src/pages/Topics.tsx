import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopics, type Topic } from '../api/client'
import { clearToken } from '../api/auth'
import './Topics.css'

function Topics() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  function handleAddTopic() {
    // TODO: implement backend call
  }

  async function handleRefresh() {
    const { data, error: apiError, status } = await getTopics()

    if (apiError) {
      setError(apiError)
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      return
    }

    setTopics(data?.topics ?? [])
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
    return <p>Loading...</p>
  }

  return (
    <div className="topics-page">
      <div className="topics-header">
        <h1>Topics</h1>
        <div className="topics-actions">
          <button className="topic-button topic-refresh" onClick={handleRefresh} title="Refresh">↻</button>
          <button className="topic-button" onClick={handleAddTopic}>Add Topic</button>
        </div>
      </div>

      {error && <p className="topics-error">{error}</p>}

      <table className="topics-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, index) => (
            <tr key={topic.id}>
              <td>{index + 1}</td>
              <td>{topic.name}</td>
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
