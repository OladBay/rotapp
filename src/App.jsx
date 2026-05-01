// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { RotaProvider } from './context/RotaContext'
import { HomeConfigProvider } from './context/HomeConfigContext'
import { OrgSetupProvider } from './context/OrgSetupContext'
import { TopBarProvider } from './context/TopBarContext'
import AppShell from './components/layout/AppShell'

import Login from './pages/Login'
import Invite from './pages/Invite'
import OrgSignup from './pages/OrgSignup'
import OrgSetupWizard from './pages/OrgSetupWizard'
import Dashboard from './pages/Dashboard'
import Rota from './pages/Rota'
import Staff from './pages/Staff'
import Calendar from './pages/Calendar'
import YearPlanner from './pages/YearPlanner'
import Account from './pages/Account'
import ManageHome from './pages/ManageHome'
import Settings from './pages/Settings'
import HomeSetupWizard from './pages/HomeSetupWizard'
import Unauthorised from './pages/Unauthorised'
import VerifyPending from './pages/VerifyPending'
import NotFound from './pages/NotFound'
import AuthCallback from './pages/AuthCallback'
import ProtectedRoute from './components/layout/ProtectedRoute'
import './utils/icons'
import './styles/globals.css'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          {/* ── Token processor — outside AuthProvider intentionally ── */}
          {/* AuthCallback must never be inside AuthProvider. It processes */}
          {/* the verification token before a session exists. Placing it   */}
          {/* inside AuthProvider causes buildUser to fire, find no        */}
          {/* profile, and sign the user out before the token is handled. */}
          <Route path='/auth/callback' element={<AuthCallback />} />

          {/* ── All other routes — inside AuthProvider ─────────────── */}
          <Route
            path='*'
            element={
              <AuthProvider>
                <RotaProvider>
                  <HomeConfigProvider>
                    <OrgSetupProvider>
                      <TopBarProvider>
                        <Routes>
                          {/* ── Public routes — no shell ───────────── */}
                          <Route path='/login' element={<Login />} />
                          <Route path='/invite/:token' element={<Invite />} />
                          <Route path='/org/signup' element={<OrgSignup />} />
                          <Route
                            path='/verify-pending'
                            element={<VerifyPending />}
                          />
                          <Route
                            path='/unauthorised'
                            element={<Unauthorised />}
                          />
                          <Route path='*' element={<NotFound />} />

                          {/* ── Wizards — no shell ────────────────── */}
                          <Route
                            path='/org-setup'
                            element={
                              <ProtectedRoute
                                allowedRoles={['operationallead', 'superadmin']}
                              >
                                <OrgSetupWizard />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/home-setup'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'manager',
                                  'deputy',
                                  'operationallead',
                                  'superadmin',
                                ]}
                              >
                                <HomeSetupWizard />
                              </ProtectedRoute>
                            }
                          />

                          {/* ── Protected routes — wrapped in AppShell */}
                          <Route
                            path='/'
                            element={
                              <ProtectedRoute>
                                <AppShell>
                                  <Navigate to='/dashboard' replace />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/dashboard'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                ]}
                              >
                                <AppShell>
                                  <Dashboard />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/rota'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                ]}
                              >
                                <AppShell>
                                  <Rota />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/staff'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                ]}
                              >
                                <AppShell>
                                  <Staff />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/calendar'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                  'senior',
                                  'rcw',
                                  'relief',
                                ]}
                              >
                                <AppShell>
                                  <Calendar />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/year-planner'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                  'senior',
                                  'rcw',
                                  'relief',
                                ]}
                              >
                                <AppShell>
                                  <YearPlanner />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/manage-home'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                ]}
                              >
                                <AppShell>
                                  <ManageHome />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/account'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                  'senior',
                                  'rcw',
                                  'relief',
                                ]}
                              >
                                <AppShell>
                                  <Account />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path='/settings'
                            element={
                              <ProtectedRoute
                                allowedRoles={[
                                  'superadmin',
                                  'operationallead',
                                  'manager',
                                  'deputy',
                                  'senior',
                                  'rcw',
                                  'relief',
                                ]}
                              >
                                <AppShell>
                                  <Settings />
                                </AppShell>
                              </ProtectedRoute>
                            }
                          />

                          {/* ── Legacy redirect ────────────────────── */}
                          <Route
                            path='/year-calendar'
                            element={<Navigate to='/year-planner' replace />}
                          />
                        </Routes>
                      </TopBarProvider>
                    </OrgSetupProvider>
                  </HomeConfigProvider>
                </RotaProvider>
              </AuthProvider>
            }
          />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
