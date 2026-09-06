import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTopics, updateTopic, type Topic } from '../api/client'
import { clearToken } from '../api/auth'
import TopicForm from '../components/TopicForm'
import '../styles/icons.css'

function EditTopic() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    async function fetchTopic() {
      const { data, error, status } = await getTopics()

      if (error) {
        if (status === 401) {
          clearToken()
          navigate('/login', { replace: true })
          return
        }
        setLoading(false)
        return
      }

      const found = data?.topics.find((t) => t.id === id)
      if (found) {
        setTopic(found)
      }
      setLoading(false)
    }

    fetchTopic()
  }, [id, navigate])

  async function handleSubmit(data: { name: string; start_at: Date | null; expired_at: Date | null; voter_count: string }) {
    if (!id || !data.start_at || !data.expired_at) {
      throw new Error('Invalid data')
    }

    const { data: result, error, status } = await updateTopic(id, {
      name: data.name,
      start_at: Math.floor(data.start_at.getTime() / 1000),
      expired_at: Math.floor(data.expired_at.getTime() / 1000),
    })

    if (error) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      throw new Error(error)
    }

    setSuccessMessage(result?.message ?? 'Topic updated successfully')
  }

  if (loading) {
    return (
      <div className="topic-form-page">
        <div className="topic-form-header">
          <h1>Loading...</h1>
          <button className="icon" onClick={() => navigate('/topics')}>←</button>
        </div>
      </div>
    )
  }

  if (!topic) {
    return <p>Topic not found</p>
  }

  const toDate = (timestamp: number) => {
    return new Date(timestamp * 1000)
  }

  return (
    <>
      {successMessage && <p className="topic-success">{successMessage}</p>}
      <TopicForm
        title="Edit Topic"
        initialName={topic.name}
        initialStartAt={toDate(topic.start_at)}
        initialExpiredAt={toDate(topic.expired_at)}
        initialVoterCount={topic.voter_count.toString()}
        disableVoterCount={true}
        onSubmit={handleSubmit}
        submitLabel="Update Topic"
      />
    </>
  )
}

export default EditTopic
