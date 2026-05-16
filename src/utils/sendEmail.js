// src/utils/sendEmail.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── Send invite email ──────────────────────────────────────────
export async function sendInviteEmail({
  toEmail,
  roleName,
  homeName,
  inviteUrl,
}) {
  const res = await fetch(`${API_BASE}/api/email/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toEmail, roleName, homeName, inviteUrl }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send invite email')
  }
  return true
}

// ── Send staff pending approval email ─────────────────────────
export async function sendStaffPendingEmail({
  toEmail,
  staffName,
  roleName,
  homeName,
  orgName,
}) {
  const res = await fetch(`${API_BASE}/api/email/staff-pending`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toEmail, staffName, roleName, homeName, orgName }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send pending approval email')
  }
  return true
}

// ── Send OL verification email ─────────────────────────────────
export async function sendOLVerifyEmail({ toEmail, name, verifyUrl }) {
  const res = await fetch(`${API_BASE}/api/email/ol-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toEmail, name, verifyUrl }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send verification email')
  }
  return true
}
