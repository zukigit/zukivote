import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './TopicForm.css'
import '../styles/icons.css'

interface TopicFormProps {
  title: string
  initialName?: string
  initialStartAt?: Date | null
  initialExpiredAt?: Date | null
  initialVoterCount?: string
  onSubmit: (data: { name: string; start_at: Date | null; expired_at: Date | null; voter_count: string }) => Promise<void>
  submitLabel: string
}

function TopicForm({
  title,
  initialName = '',
  initialStartAt = null,
  initialExpiredAt = null,
  initialVoterCount = '',
  onSubmit,
  submitLabel,
}: TopicFormProps) {
  const navigate = useNavigate()
  const [name, setName] = useState(initialName)
  const [startAt, setStartAt] = useState<Date | null>(initialStartAt)
  const [expiredAt, setExpiredAt] = useState<Date | null>(initialExpiredAt)
  const [voterCount, setVoterCount] = useState(initialVoterCount)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await onSubmit({ name, start_at: startAt, expired_at: expiredAt, voter_count: voterCount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="topic-form-page">
      <div className="topic-form-header">
        <h1>{title}</h1>
        <button className="icon" onClick={() => navigate('/topics')}>←</button>
      </div>

      <form className="topic-form" onSubmit={handleSubmit}>
        {error && <p className="topic-form-error">{error}</p>}
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-topic"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="startAt">Start Time</label>
          <DatePicker
            id="startAt"
            selected={startAt}
            onChange={(date: Date | null) => setStartAt(date)}
            showTimeSelect
            timeIntervals={1}
            timeFormat="HH:mm"
            dateFormat="yyyy-MM-dd HH:mm"
            placeholderText="Select start time"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="expiredAt">End Time</label>
          <DatePicker
            id="expiredAt"
            selected={expiredAt}
            onChange={(date: Date | null) => setExpiredAt(date)}
            showTimeSelect
            timeIntervals={1}
            timeFormat="HH:mm"
            dateFormat="yyyy-MM-dd HH:mm"
            placeholderText="Select end time"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="voterCount">Voter Count</label>
          <input
            id="voterCount"
            type="number"
            min="1"
            value={voterCount}
            onChange={(e) => setVoterCount(e.target.value)}
            placeholder="3"
            required
          />
        </div>
        <button type="submit" className="topic-submit-button" disabled={submitting}>
          {submitting ? 'Submitting...' : submitLabel}
        </button>
      </form>
    </div>
  )
}

export default TopicForm
