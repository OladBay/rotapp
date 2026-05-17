// api/routes/auth.js
import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

    if (error || !profile) {
      return res.status(200).json({ found: false })
    }

    if (profile.email_verified) {
      return res.status(200).json({ found: true, alreadyVerified: true })
    }

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
// Also fires staff_pending notifications and emails to manager and OL
router.post('/update-profile', async (req, res) => {
  const { userId, updates, notify } = req.body

  if (!userId || !updates) {
    return res.status(400).json({ error: 'Missing userId or updates' })
  }

  try {
    const supabaseAdmin = getAdminClient()

    // 1. Update the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (profileError) {
      console.error('update-profile error:', profileError)
      return res.status(500).json({ error: profileError.message })
    }
    // 2. Mark invite token as used if provided
    if (req.body.inviteToken) {
      await supabaseAdmin
        .from('invite_tokens')
        .update({
          used_at: new Date().toISOString(),
          used_by: userId,
        })
        .eq('token', req.body.inviteToken)
    }
    // 2. Fire staff_pending notifications and emails if notify context provided
    if (notify) {
      const { orgId, staffName, roleName, homeName, orgName, homeId } = notify

      const notificationRows = []
      let manager = null
      let ol = null

      // Look up home manager if home-based staff
      if (homeId) {
        const { data: managerData } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email')
          .eq('home', homeId)
          .eq('role', 'manager')
          .eq('status', 'active')
          .maybeSingle()

        manager = managerData

        if (manager) {
          notificationRows.push({
            org_id: orgId,
            recipient_id: manager.id,
            type: 'staff_pending',
            reference_id: userId,
            reference_table: 'profiles',
            message: `${staffName} has signed up as ${roleName} at ${homeName} and is awaiting your approval.`,
            created_by_id: userId,
            created_by_name: staffName,
            link: '/staff',
          })
        }
      }

      // Look up OL for the org
      const { data: olData } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .eq('org_id', orgId)
        .eq('role', 'operationallead')
        .eq('status', 'active')
        .maybeSingle()

      ol = olData

      if (ol) {
        const olMessage = homeName
          ? `${staffName} has signed up as ${roleName} at ${homeName} and is awaiting approval.`
          : `${staffName} has joined the relief pool for ${orgName} and is awaiting your approval.`

        notificationRows.push({
          org_id: orgId,
          recipient_id: ol.id,
          type: 'staff_pending',
          reference_id: userId,
          reference_table: 'profiles',
          message: olMessage,
          created_by_id: userId,
          created_by_name: staffName,
          link: '/staff',
        })
      }

      // Insert all in-app notifications
      if (notificationRows.length > 0) {
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notificationRows)

        if (notifError) {
          console.error('update-profile notify error:', notifError)
          // Don't fail the request — profile update succeeded
        }
      }

      // Send emails to manager and OL via Resend
      const resend = new Resend(process.env.RESEND_API_KEY)
      const staffPageUrl = `${process.env.ALLOWED_ORIGIN || 'http://localhost:5173'}/staff`
      const emailTargets = []

      if (manager?.email) {
        emailTargets.push({ email: manager.email, name: manager.name })
      }
      if (ol?.email) {
        emailTargets.push({ email: ol.email, name: ol.name })
      }

      for (const target of emailTargets) {
        resend.emails
          .send({
            from: 'Rotapp <invites@myrotapp.com>',
            to: target.email,
            subject: `New staff account pending approval — ${staffName}`,
            html: `
            <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
              <div style="margin-bottom: 32px;">
                <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">
                  Rot<span style="color: #2a7f62;">app</span>
                </span>
              </div>
              <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
                New account pending your approval
              </h1>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
                Hi ${target.name || 'there'},<br/><br/>
                A new staff member has signed up and is awaiting your approval before they can access Rotapp.
              </p>
              <div style="background: #f5f6fa; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Name</td>
                    <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${staffName}</td>
                  </tr>
                  <tr style="border-top: 1px solid #e5e7eb;">
                    <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Role</td>
                    <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${roleName}</td>
                  </tr>
                  <tr style="border-top: 1px solid #e5e7eb;">
                    <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">${homeName ? 'Home' : 'Pool'}</td>
                    <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${homeName || `Relief pool — ${orgName}`}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 32px;">
                Log in to Rotapp and go to <strong>Manage Staff → Pending</strong> to review and approve this account.
              </p>
              <a href="${staffPageUrl}"
                style="display: inline-block; background: #2a7f62; color: #ffffff; text-decoration: none;
                       padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
                Review pending staff →
              </a>
              <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                If you weren't expecting this, you can decline the account from the Manage Staff page.
              </p>
            </div>
          `,
          })
          .catch((err) => console.error('Staff pending email failed:', err))
      }
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('update-profile exception:', err)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ── POST /api/auth/verify-email (profile update) ───────────────
// Marks email_verified = true on the profile using Admin client
router.post('/update-profile/verify', async (req, res) => {
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
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

export default router
