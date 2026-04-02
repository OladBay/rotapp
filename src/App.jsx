import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Rota from './pages/Rota'
import Calendar from './pages/Calendar'
import Staff from './pages/Staff'
import NotFound from './pages/NotFound'

const MANAGER_ROLES = [
  'superadmin',
  'operationallead',
  'manager',
  'deputy',
  'senior',
]
const CARER_ROLES = ['rcw', 'relief']

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to='/login' />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />

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

        <Route path='*' element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
