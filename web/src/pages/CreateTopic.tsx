import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTopic } from '../api/client'
import { clearToken } from '../api/auth'
import TopicForm from '../components/TopicForm'

function CreateTopic() {
  const navigate = useNavigate()
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(data: { name: string; start_at: Date | null; expired_at: Date | null }) {
    setSuccessMessage('')

    const { error, status } = await createTopic({
      name: data.name,
      start_at: data.start_at ? Math.floor(data.start_at.getTime() / 1000) : 0,
      expired_at: data.expired_at ? Math.floor(data.expired_at.getTime() / 1000) : 0,
    })

    if (error) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      throw new Error(error)
    }

    setSuccessMessage('Topic created successfully')
  }

  return (
    <TopicForm
      title="Create Topic"
      clearOnSuccess={true}
      successMessage={successMessage}
      onSubmit={handleSubmit}
      submitLabel="Create Topic"
    />
  )
}

export default CreateTopic
