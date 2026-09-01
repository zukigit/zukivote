import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../api/auth'
import './Layout.css'

function Sidebar() {
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-header">zukivote</div>
      <ul className="sidebar-links">
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/profile" className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}>
            Profile
          </NavLink>
        </li>
      </ul>
      <button className="sidebar-logout" onClick={handleLogout}>
        Logout
      </button>
    </nav>
  )
}

export default Sidebar
