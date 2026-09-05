import { useNavigate } from 'react-router-dom'
import { createTopic } from '../api/client'
import { clearToken } from '../api/auth'
import TopicForm from '../components/TopicForm'

function CreateTopic() {
  const navigate = useNavigate()

  async function handleSubmit(data: { name: string; start_at: Date | null; expired_at: Date | null; voter_count: string }) {
    const { error, status } = await createTopic({
      name: data.name,
      start_at: data.start_at ? Math.floor(data.start_at.getTime() / 1000) : 0,
      expired_at: data.expired_at ? Math.floor(data.expired_at.getTime() / 1000) : 0,
      voter_count: parseInt(data.voter_count, 10),
    })

    if (error) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      throw new Error(error)
    }

    navigate('/topics')
  }

  return (
    <TopicForm
      title="Create Topic"
      onSubmit={handleSubmit}
      submitLabel="Create Topic"
    />
  )
}

export default CreateTopic
