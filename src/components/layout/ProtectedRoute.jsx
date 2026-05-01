// src/components/layout/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useHomeConfig } from '../../context/HomeConfigContext'
import { useOrgSetup } from '../../context/OrgSetupContext'
import { ROUTE_ACCESS } from '../../config/routeAccess'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { isWizardComplete, configLoading } = useHomeConfig()
  const { isOrgWizardComplete, orgSetupLoading } = useOrgSetup()
  const location = useLocation()

  // Wait for auth, home config, and org setup to resolve
  if (loading || configLoading || orgSetupLoading) return null

  // Not logged in
  if (!user) return <Navigate to='/login' replace />

  // Blocked account
  if (user.blockedStatus) return <Navigate to='/login' replace />

  // ── Gate 1 — Email verification ──────────────────────────────
  // Must be verified before any other gate fires.
  // Already on /verify-pending — let through to avoid redirect loop.
  if (!user.emailVerified && location.pathname !== '/verify-pending') {
    return <Navigate to='/verify-pending' replace />
  }

  // Path not in config — fail safe, deny access
  const allowedRoles = ROUTE_ACCESS[location.pathname]
  if (!allowedRoles) return <Navigate to='/unauthorised' replace />

  // Role not permitted for this route
  if (!allowedRoles.includes(user.activeRole)) {
    return <Navigate to='/unauthorised' replace />
  }

  // ── Gate 2 — Org wizard ───────────────────────────────────────
  // Applies to operationallead and superadmin only.
  // If their org setup is not complete, redirect to /org-setup.
  // Already on /org-setup — let through to avoid redirect loop.
  if (
    location.pathname !== '/org-setup' &&
    (user.activeRole === 'operationallead' ||
      user.activeRole === 'superadmin') &&
    user.org_id &&
    !isOrgWizardComplete
  ) {
    return <Navigate to='/org-setup' replace />
  }

  // ── Gate 3 — Home wizard ──────────────────────────────────────
  // Only applies when user has a home assigned.
  // OLs with no home stepped in are never gated.
  // Already on /home-setup — let through to avoid redirect loop.
  if (user?.home && !isWizardComplete && location.pathname !== '/home-setup') {
    if (
      user.activeRole === 'manager' ||
      user.activeRole === 'deputy' ||
      user.activeRole === 'operationallead' ||
      user.activeRole === 'superadmin'
    ) {
      return <Navigate to='/home-setup' replace />
    }
  }

  return children
}

export default ProtectedRoute
