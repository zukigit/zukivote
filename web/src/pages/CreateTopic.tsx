import { useNavigate } from 'react-router-dom'
import { createTopic } from '../api/client'
import { clearToken } from '../api/auth'
import TopicForm from '../components/TopicForm'

function CreateTopic() {
  const navigate = useNavigate()

  async function handleSubmit(data: { name: string; start_at: string; expired_at: string; voter_count: string }) {
    const { error, status } = await createTopic({
      name: data.name,
      start_at: Math.floor(new Date(data.start_at).getTime() / 1000),
      expired_at: Math.floor(new Date(data.expired_at).getTime() / 1000),
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
