// api/routes/auth.js
import express from 'express'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const getAdminClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ── POST /api/auth/confirm-user ────────────────────────────────
// Used for invite signups — auto-confirms email immediately
// Staff proved email ownership by clicking the invite link
router.post('/confirm-user', async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const supabaseAdmin = getAdminClient()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (error) {
      console.error('confirm-user error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('confirm-user exception:', err)
    return res.status(500).json({ error: 'Failed to confirm user' })
  }
})

// ── POST /api/auth/generate-verify-token ──────────────────────
// Used for OL signups — creates a verification token in our own
// email_verifications table and returns it for use in Resend email
router.post('/generate-verify-token', async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const supabaseAdmin = getAdminClient()

    // Invalidate any existing unused tokens for this user first
    await supabaseAdmin
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null)

    // Insert a fresh verification token row
    const { data, error } = await supabaseAdmin
      .from('email_verifications')
      .insert({ user_id: userId })
      .select('token')
      .single()

    if (error || !data?.token) {
      console.error('generate-verify-token error:', error)
      return res
        .status(500)
        .json({ error: 'Failed to generate verification token' })
    }

    return res.status(200).json({ token: data.token })
  } catch (err) {
    console.error('generate-verify-token exception:', err)
    return res
      .status(500)
      .json({ error: 'Failed to generate verification token' })
  }
})
// ── POST /api/auth/verify-email ────────────────────────────────
// Marks email_verified = true on the profile using Admin client
// Called from VerifyEmail.jsx after token validation succeeds
router.post('/verify-email', async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', userId)

    if (error) {
      console.error('verify-email error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('verify-email exception:', err)
    return res.status(500).json({ error: 'Failed to verify email' })
  }
})

// ── POST /api/auth/lookup-unverified ──────────────────────────
// Looks up a profile by email using Admin client (bypasses RLS)
// Returns userId only if the user is an unverified OL/superadmin
// Never reveals whether an email exists if conditions aren't met
router.post('/lookup-unverified', async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Missing email' })
  }

  try {
    const supabaseAdmin = getAdminClient()

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email_verified')
      .eq('email', email.trim().toLowerCase())
      .single()

    // If not found or any error — return generic response
    // Never reveal whether email exists
    if (error || !profile) {
      return res.status(200).json({ found: false })
    }

    // Already verified
    if (profile.email_verified) {
      return res.status(200).json({ found: true, alreadyVerified: true })
    }

    // Only OL/superadmin use email verification
    if (profile.role !== 'operationallead' && profile.role !== 'superadmin') {
      return res.status(200).json({ found: false })
    }

    return res.status(200).json({ found: true, userId: profile.id })
  } catch (err) {
    console.error('lookup-unverified exception:', err)
    return res.status(500).json({ error: 'Lookup failed' })
  }
})

// ── POST /api/auth/update-profile ─────────────────────────────
// Updates a newly created staff profile using Admin client
// bypasses RLS — used after invite signup where no session exists
router.post('/update-profile', async (req, res) => {
  const { userId, updates } = req.body

  if (!userId || !updates) {
    return res.status(400).json({ error: 'Missing userId or updates' })
  }

  try {
    const supabaseAdmin = getAdminClient()

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('update-profile error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('update-profile exception:', err)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

export default router
