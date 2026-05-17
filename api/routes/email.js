// api/routes/email.js
import express from 'express'
import { Resend } from 'resend'

const router = express.Router()

// ── POST /api/email/invite ─────────────────────────────────────
router.post('/invite', async (req, res) => {
  const { toEmail, roleName, homeName, inviteUrl } = req.body

  if (!toEmail || !roleName || !inviteUrl) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Rotapp Invites <invites@myrotapp.com>',
      to: toEmail,
      subject: `You've been invited to join Rotapp`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">
              Rot<span style="color: #2a7f62;">app</span>
            </span>
          </div>
          <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
            You've been invited
          </h1>
          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Hi there,<br/><br/>
            You've been invited to join <strong>${homeName || 'your care home'}</strong> on Rotapp as <strong>${roleName}</strong>.
          </p>
          <a href="${inviteUrl}"
            style="display: inline-block; background: #2a7f62; color: #ffffff; text-decoration: none;
                   padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Create your account →
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.6;">
            This invite link expires in 7 days. If you weren't expecting this email, you can safely ignore it.
          </p>
        </div>
      `,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send invite email' })
  }
})

// ── POST /api/email/staff-pending ─────────────────────────────
router.post('/staff-pending', async (req, res) => {
  const { toEmail, staffName, roleName, homeName, orgName } = req.body

  if (!toEmail || !staffName || !roleName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Rotapp <invites@myrotapp.com>',
      to: toEmail,
      subject: `Your Rotapp account is pending approval`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">
              Rot<span style="color: #2a7f62;">app</span>
            </span>
          </div>

          <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
            Account created — awaiting approval
          </h1>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Hi ${staffName},<br/><br/>
            Your Rotapp account has been successfully created. Here's a summary of your details:
          </p>

          <div style="background: #f5f6fa; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Organisation</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${orgName || '—'}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Role</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${roleName}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Home</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${homeName || 'Org-wide relief'}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Your account is now awaiting approval from your manager. Once approved, you'll have full access to your shifts, rota, and schedule on Rotapp.
          </p>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 32px;">
            You don't need to do anything right now — we'll let you know as soon as you're approved. In the meantime, you can visit the login page and your manager will approve your account shortly.
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            If you didn't create this account or believe this was sent in error, please ignore this email.
          </p>
        </div>
      `,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send pending email' })
  }
})

// ── POST /api/email/ol-verify ──────────────────────────────────
router.post('/ol-verify', async (req, res) => {
  const { toEmail, name, verifyUrl } = req.body

  if (!toEmail || !verifyUrl) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Rotapp <invites@myrotapp.com>',
      to: toEmail,
      subject: `Verify your email to continue setting up Rotapp`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">
              Rot<span style="color: #2a7f62;">app</span>
            </span>
          </div>

          <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
            Verify your email address
          </h1>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Hi ${name},<br/><br/>
            Thanks for signing up to Rotapp. Please verify your email address to continue setting up your organisation.
          </p>

          <a href="${verifyUrl}"
            style="display: inline-block; background: #2a7f62; color: #ffffff; text-decoration: none;
                   padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Verify my email →
          </a>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin-top: 24px;">
            Once verified, you'll be taken to set up your organisation on Rotapp.
          </p>

          <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            This link expires in 24 hours. If you didn't sign up for Rotapp, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send verification email' })
  }
})

// ── POST /api/email/staff-approved ────────────────────────────
router.post('/staff-approved', async (req, res) => {
  const { toEmail, staffName, roleName, homeName, orgName, loginUrl } = req.body

  if (!toEmail || !staffName || !roleName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Rotapp <invites@myrotapp.com>',
      to: toEmail,
      subject: `Your Rotapp account has been approved`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">
              Rot<span style="color: #2a7f62;">app</span>
            </span>
          </div>

          <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
            Your account has been approved
          </h1>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Hi ${staffName},<br/><br/>
            Great news — your Rotapp account has been approved. You now have full access to your shifts and schedule.
          </p>

          <div style="background: #f5f6fa; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Organisation</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${orgName || '—'}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Role</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${roleName}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="font-size: 12px; color: #888; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.8px;">Home</td>
                <td style="font-size: 14px; color: #1a1a1a; font-weight: 500; padding: 6px 0; text-align: right;">${homeName || 'Org-wide relief'}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 32px;">
            You can now log in to Rotapp to view your shifts, rota and schedule.
          </p>

          <a href="${loginUrl}"
            style="display: inline-block; background: #2a7f62; color: #ffffff; text-decoration: none;
                   padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Log in to Rotapp →
          </a>

          <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            If you have any questions, please contact your manager.
          </p>
        </div>
      `,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send approval email' })
  }
})

// ── POST /api/email/staff-pending-manager ─────────────────────
router.post('/staff-pending-manager', async (req, res) => {
  const {
    toEmail,
    managerName,
    staffName,
    roleName,
    homeName,
    orgName,
    staffPageUrl,
  } = req.body

  if (!toEmail || !staffName || !roleName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: 'Rotapp <invites@myrotapp.com>',
      to: toEmail,
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
            Hi ${managerName || 'there'},<br/><br/>
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
            If you weren't expecting this, someone may have used your organisation's invite link. You can decline the account from the Manage Staff page.
          </p>
        </div>
      `,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res
      .status(500)
      .json({ error: 'Failed to send pending manager email' })
  }
})

export default router
