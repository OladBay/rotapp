import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to='/login' />
  }

  if (allowedRoles && !allowedRoles.includes(user.activeRole)) {
    return <Navigate to='/login' />
  }

  return children
}

export default ProtectedRoute
