import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createItem } from '../api/client'
import { clearToken } from '../api/auth'
import './CreateItem.css'

interface KeyValue {
  key: string
  value: string
}

function CreateItem() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [values, setValues] = useState<KeyValue[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!topicId) {
    return (
      <div className="create-item-page">
        <div className="create-item-header">
          <button className="icon" onClick={() => navigate('/items')}>←</button>
          <h1>Error</h1>
        </div>
        <p>Topic ID is required</p>
      </div>
    )
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError('Photo must be less than 8MB')
        setPhoto(null)
        return
      }
      setError('')
      setPhoto(file)
    }
  }

  function addKeyValue() {
    setValues([...values, { key: '', value: '' }])
  }

  function removeKeyValue(index: number) {
    setValues(values.filter((_, i) => i !== index))
  }

  function updateKeyValue(index: number, field: 'key' | 'value', val: string) {
    const newValues = [...values]
    newValues[index] = { ...newValues[index], [field]: val }
    setValues(newValues)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!description.trim()) {
      setError('Description is required')
      return
    }

    if (!photo) {
      setError('Photo is required')
      return
    }

    const validValues = values.filter(v => v.key.trim() && v.value.trim())
    for (const v of validValues) {
      if (!v.key.trim() || !v.value.trim()) {
        setError('All key-value pairs must have both key and value')
        return
      }
    }

    setSubmitting(true)

    const { error: apiError, status } = await createItem({
      topic_id: topicId!,
      description: description.trim(),
      values: validValues.length > 0 ? validValues : undefined,
      photo,
    })

    setSubmitting(false)

    if (apiError) {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      setError(apiError ?? 'Something went wrong')
      return
    }

    setSuccess('Item created successfully')
    setDescription('')
    setPhoto(null)
    setValues([])
    const fileInput = document.getElementById('photo') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  return (
    <div className="create-item-page">
      <div className="create-item-header">
        <button className="icon" onClick={() => navigate('/items', { state: { topicId } })}>←</button>
        <h1>Create Item</h1>
      </div>

      <form className="create-item-form" onSubmit={handleSubmit}>
        {error && <p className="create-item-error">{error}</p>}
        {success && <p className="create-item-success">{success}</p>}

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Item description"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="photo">Photo</label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />
          {photo && <p className="file-name">{photo.name}</p>}
        </div>

        <div className="form-group">
          <label>Key-Value Pairs (optional)</label>
          {values.map((kv, index) => (
            <div key={index} className="key-value-row">
              <input
                type="text"
                value={kv.key}
                onChange={(e) => updateKeyValue(index, 'key', e.target.value)}
                placeholder="Key"
              />
              <input
                type="text"
                value={kv.value}
                onChange={(e) => updateKeyValue(index, 'value', e.target.value)}
                placeholder="Value"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeKeyValue(index)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addKeyValue}>
            + Add Key-Value
          </button>
        </div>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Item'}
        </button>
      </form>
    </div>
  )
}

export default CreateItem
