import { Navigate } from 'react-router-dom'
import { getToken } from '../api/auth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default PrivateRoute
