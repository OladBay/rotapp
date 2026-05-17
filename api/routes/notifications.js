// api/routes/notifications.js
import express from 'express'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const getAdminClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ── POST /api/notifications/create ────────────────────────────────
// Creates one or more notification rows using Admin client
// Bypasses RLS — used when no session exists (e.g. invite signup)
// or when backend needs to notify multiple recipients at once
router.post('/create', async (req, res) => {
  const { notifications } = req.body

  if (
    !notifications ||
    !Array.isArray(notifications) ||
    notifications.length === 0
  ) {
    return res
      .status(400)
      .json({ error: 'Missing or empty notifications array' })
  }

  // Validate each notification
  for (const n of notifications) {
    if (
      !n.orgId ||
      !n.recipientId ||
      !n.type ||
      !n.referenceId ||
      !n.referenceTable ||
      !n.message ||
      !n.createdById ||
      !n.createdByName
    ) {
      return res.status(400).json({
        error:
          'Each notification must have orgId, recipientId, type, referenceId, referenceTable, message, createdById, createdByName',
      })
    }
  }

  const rows = notifications.map((n) => ({
    org_id: n.orgId,
    recipient_id: n.recipientId,
    type: n.type,
    reference_id: n.referenceId,
    reference_table: n.referenceTable,
    message: n.message,
    created_by_id: n.createdById,
    created_by_name: n.createdByName,
    link: n.link || null,
  }))

  try {
    const supabaseAdmin = getAdminClient()
    const { error } = await supabaseAdmin.from('notifications').insert(rows)

    if (error) {
      console.error('notifications/create error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('notifications/create exception:', err)
    return res.status(500).json({ error: 'Failed to create notifications' })
  }
})

export default router
