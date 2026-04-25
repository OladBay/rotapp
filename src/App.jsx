import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import StickyNote from './components/StickyNote'
// SessionBanner is rendered inside Navbar
import Login from './pages/Login'
import Invite from './pages/Invite'
import Dashboard from './pages/Dashboard'
import Rota from './pages/Rota'
import Calendar from './pages/Calendar'
import Staff from './pages/Staff'
import YearCalendar from './pages/YearCalendar'
import NotFound from './pages/NotFound'
import Unauthorised from './pages/Unauthorised'
import HomeSetupWizard from './pages/HomeSetupWizard'

// Role arrays removed — access rules live in src/config/routeAccess.js

function AppContent() {
  const location = useLocation()
  const hideSticky = location.pathname.startsWith('/invite')

  return (
    <>
      {!hideSticky && <StickyNote />}
      <Routes>
        <Route path='/' element={<Navigate to='/login' />} />
        <Route path='/login' element={<Login />} />
        <Route path='/invite/:token' element={<Invite />} />

        <Route
          path='/dashboard'
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path='/rota'
          element={
            <ProtectedRoute>
              <Rota />
            </ProtectedRoute>
          }
        />

        <Route
          path='/calendar'
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path='/staff'
          element={
            <ProtectedRoute>
              <Staff />
            </ProtectedRoute>
          }
        />

        <Route
          path='/year-calendar'
          element={
            <ProtectedRoute>
              <YearCalendar />
            </ProtectedRoute>
          }
        />

        <Route
          path='/home-setup'
          element={
            <ProtectedRoute>
              <HomeSetupWizard />
            </ProtectedRoute>
          }
        />
        <Route path='/unauthorised' element={<Unauthorised />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
