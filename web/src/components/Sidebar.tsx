import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { getMe, type User } from '../api/client'
import { clearToken } from '../api/auth'
import './Layout.css'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    getMe().then(({ data, status }) => {
      if (status === 401) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      setUser(data)
    })
  }, [navigate])

  function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return
    clearToken()
    navigate('/login', { replace: true })
  }

  function handleNavClick() {
    onClose()
  }

  return (
    <nav className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">zukivote</span>
        <span className="sidebar-username">{user?.user_name ?? '...'}</span>
      </div>
      <ul className="sidebar-links">
        <li>
          <NavLink to="/dashboard" onClick={handleNavClick} className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
            Dashboard
          </NavLink>
        </li>
      </ul>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  )
}

export default Sidebar
