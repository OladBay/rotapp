// ── Route Access Config ────────────────────────────────────────────────────
// Single source of truth for role-based route access.
// To change who can access a route, edit this file only.
// ProtectedRoute reads from this config — never hardcode roles in App.jsx.

export const ROUTE_ACCESS = {
  '/home-setup': ['manager', 'deputy', 'operationallead', 'superadmin'],
  '/dashboard': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
  ],
  '/rota': ['superadmin', 'operationallead', 'manager', 'deputy', 'senior'],
  '/staff': ['superadmin', 'operationallead', 'manager'],
  '/calendar': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
  '/year-calendar': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
  ],
}
