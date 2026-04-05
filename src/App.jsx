import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import StickyNote from './components/StickyNote'
import Login from './pages/Login'
import Invite from './pages/Invite'
import Dashboard from './pages/Dashboard'
import Rota from './pages/Rota'
import Calendar from './pages/Calendar'
import Staff from './pages/Staff'
import YearCalendar from './pages/YearCalendar'
import NotFound from './pages/NotFound'

const MANAGER_ROLES = [
  'superadmin',
  'operationallead',
  'manager',
  'deputy',
  'senior',
]
const CARER_ROLES = ['rcw', 'relief']

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
            <ProtectedRoute allowedRoles={MANAGER_ROLES}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path='/rota'
          element={
            <ProtectedRoute allowedRoles={MANAGER_ROLES}>
              <Rota />
            </ProtectedRoute>
          }
        />

        <Route
          path='/calendar'
          element={
            <ProtectedRoute allowedRoles={[...MANAGER_ROLES, ...CARER_ROLES]}>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path='/staff'
          element={
            <ProtectedRoute allowedRoles={['superadmin', 'manager']}>
              <Staff />
            </ProtectedRoute>
          }
        />

        <Route
          path='/year-calendar'
          element={
            <ProtectedRoute
              allowedRoles={[
                'manager',
                'deputy',
                'senior',
                'operationallead',
                'superadmin',
              ]}
            >
              <YearCalendar />
            </ProtectedRoute>
          }
        />

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
