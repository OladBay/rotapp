import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROUTE_ACCESS } from '../../config/routeAccess'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  // Not logged in
  if (!user) return <Navigate to='/login' replace />

  // Blocked account — Login page handles the blocked screens
  if (user.blockedStatus) return <Navigate to='/login' replace />

  // Path not in config — fail safe, deny access
  const allowedRoles = ROUTE_ACCESS[location.pathname]
  if (!allowedRoles) return <Navigate to='/unauthorised' replace />

  // Role not permitted for this route
  if (!allowedRoles.includes(user.activeRole)) {
    return <Navigate to='/unauthorised' replace />
  }

  return children
}

export default ProtectedRoute
