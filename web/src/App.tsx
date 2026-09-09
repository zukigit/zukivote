import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Topics from './pages/Topics'
import CreateTopic from './pages/CreateTopic'
import EditTopic from './pages/EditTopic'
import Items from './pages/Items'
import CreateItem from './pages/CreateItem'
import Voters from './pages/Voters'
import Voting from './pages/Voting'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/voting/:topicId" element={<Voting />} />
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
        <Route path="/items" element={<Items />} />
        <Route path="/items/create" element={<CreateItem />} />
        <Route path="/voters" element={<Voters />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
