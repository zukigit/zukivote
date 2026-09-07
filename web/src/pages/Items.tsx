import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getItems, getPhotoUrl, type Item } from '../api/client'
import { clearToken } from '../api/auth'
import './Items.css'

function Items() {
  const navigate = useNavigate()
  const location = useLocation()
  const topicId = (location.state as { topicId?: string })?.topicId
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function fetchItems() {
    if (!topicId) {
      setError('Topic ID is required')
      setLoading(false)
      return
    }

    const { data, error: apiError, status } = await getItems(topicId)

    if (apiError) {
      setError(apiError)
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      setLoading(false)
      return
    }

    setItems(data?.items ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
  }, [topicId])

  async function handleRefresh() {
    setLoading(true)
    setMessage('')
    setError('')

    const { data, error: apiError, status } = await getItems(topicId!)

    if (apiError) {
      setError(apiError)
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
      }
      setLoading(false)
      return
    }

    const newItems = data?.items ?? []
    if (JSON.stringify(newItems) === JSON.stringify(items)) {
      setMessage('No updates')
    } else {
      setMessage('Data updated')
    }
    setItems(newItems)
    setLoading(false)

    setTimeout(() => setMessage(''), 2000)
  }

  if (loading) {
    return (
      <div className="items-page">
        <div className="items-header">
          <button className="icon" onClick={() => navigate('/topics')}>←</button>
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="items-page">
      <div className="items-header">
        <button className="icon" onClick={() => navigate('/topics')}>←</button>
        <h1>Items</h1>
        <button className="icon" onClick={() => navigate('/items/create', { state: { topicId } })} title="Add Item">+</button>
        <button className="icon" onClick={handleRefresh} title="Refresh" disabled={loading}>↻</button>
      </div>

      {error && <p className="items-error">{error}</p>}
      {message && <p className={message === 'No updates' ? 'items-info' : 'items-message'}>{message}</p>}

      {items.length === 0 ? (
        <p className="items-empty">No items found</p>
      ) : (
        <div className="items-grid">
          {items.map((item) => (
            <div key={item.id} className="item-card">
              <div className="item-photo">
                <img
                  src={getPhotoUrl(item.id)}
                  alt={item.description}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="item-details">
                <h3 className="item-description">{item.description}</h3>
                {item.values.length > 0 && (
                  <div className="item-values">
                    {item.values.map((value) => (
                      <div key={value.id} className="item-value">
                        <span className="value-key">{value.key}:</span>
                        <span className="value-value">{value.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Items
