import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Topics from './pages/Topics'
import CreateTopic from './pages/CreateTopic'
import EditTopic from './pages/EditTopic'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/topics/create" element={<CreateTopic />} />
        <Route path="/topics/edit/:id" element={<EditTopic />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
