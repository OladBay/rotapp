// src/components/layout/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useHomeConfig } from '../../context/HomeConfigContext'
import { ROUTE_ACCESS } from '../../config/routeAccess'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { isWizardComplete, configLoading } = useHomeConfig()
  const location = useLocation()

  // Wait for both auth and config to resolve
  if (loading || configLoading) return null

  // Not logged in
  if (!user) return <Navigate to='/login' replace />

  // Blocked account
  if (user.blockedStatus) return <Navigate to='/login' replace />

  // Path not in config — fail safe, deny access
  const allowedRoles = ROUTE_ACCESS[location.pathname]
  if (!allowedRoles) return <Navigate to='/unauthorised' replace />

  // Role not permitted for this route
  if (!allowedRoles.includes(user.activeRole)) {
    return <Navigate to='/unauthorised' replace />
  }

  // ── Wizard gate ──────────────────────────────────────────────────────
  // Only applies when user has a home assigned.
  // OLs with no home stepped in are never gated.
  // Already on /home-setup — let through to avoid redirect loop.
  if (user?.home && !isWizardComplete && location.pathname !== '/home-setup') {
    // Manager or deputy — hard redirect, no choice
    if (user.activeRole === 'manager' || user.activeRole === 'deputy') {
      return <Navigate to='/home-setup' replace />
    }

    // OL or superadmin stepped into incomplete home
    // — redirect to home-setup but wizard will show
    // the interstitial screen with a choice
    if (
      user.activeRole === 'operationallead' ||
      user.activeRole === 'superadmin'
    ) {
      return <Navigate to='/home-setup' replace />
    }
  }

  return children
}

export default ProtectedRoute
