// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RotaProvider } from './context/RotaContext'
import { HomeConfigProvider } from './context/HomeConfigContext'
import AppShell from './components/layout/AppShell'

import Login from './pages/Login'
import Invite from './pages/Invite'
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
import NotFound from './pages/NotFound'

import ProtectedRoute from './components/layout/ProtectedRoute'
import './utils/icons'
import './styles/globals.css'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <RotaProvider>
            <HomeConfigProvider>
              <Routes>
                {/* ── Public routes — no shell ───────────── */}
                <Route path='/login' element={<Login />} />
                <Route path='/invite/:token' element={<Invite />} />
                <Route path='/unauthorised' element={<Unauthorised />} />
                <Route path='*' element={<NotFound />} />

                {/* ── Wizard — no shell ─────────────────── */}
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
            </HomeConfigProvider>
          </RotaProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
