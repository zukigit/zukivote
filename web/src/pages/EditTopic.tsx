import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTopics, type Topic } from '../api/client'
import { clearToken } from '../api/auth'
import TopicForm from '../components/TopicForm'

function EditTopic() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

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

  async function handleSubmit(_data: { name: string; start_at: Date | null; expired_at: Date | null; voter_count: string }) {
    // TODO: implement update topic API call
    navigate('/topics')
  }

  if (loading) {
    return <p>Loading...</p>
  }

  if (!topic) {
    return <p>Topic not found</p>
  }

  const toDate = (timestamp: number) => {
    return new Date(timestamp * 1000)
  }

  return (
    <TopicForm
      title="Edit Topic"
      initialName={topic.name}
      initialStartAt={toDate(topic.start_at)}
      initialExpiredAt={toDate(topic.expired_at)}
      onSubmit={handleSubmit}
      submitLabel="Update Topic"
    />
  )
}

export default EditTopic
