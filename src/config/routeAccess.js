// src/config/routeAccess.js
// ── Route Access Config ────────────────────────────────────────
// Single source of truth for role-based route access.
// To change who can access a route, edit this file only.
// ProtectedRoute reads from this config — never hardcode roles in App.jsx.

export const ROUTE_ACCESS = {
  '/': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
  '/home-setup': ['manager', 'deputy', 'operationallead', 'superadmin'],
  '/dashboard': ['superadmin', 'operationallead', 'manager', 'deputy'],
  '/rota': ['superadmin', 'operationallead', 'manager', 'deputy'],
  '/staff': ['superadmin', 'operationallead', 'manager', 'deputy'],
  '/calendar': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
  '/year-planner': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
  '/manage-home': ['superadmin', 'operationallead', 'manager', 'deputy'],
  '/account': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
  '/settings': [
    'superadmin',
    'operationallead',
    'manager',
    'deputy',
    'senior',
    'rcw',
    'relief',
  ],
}
