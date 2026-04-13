import { supabase } from '../lib/supabase'

// ── Notification types ─────────────────────────────────────────────
// Single source of truth for all notification type strings.
// When adding new features, add new types here only.
export const NOTIFICATION_TYPES = {
  TRANSFER_INCOMING: 'transfer_incoming',
  TRANSFER_ACCEPTED: 'transfer_accepted',
  TRANSFER_REJECTED: 'transfer_rejected',
  TRANSFER_CANCELLED: 'transfer_cancelled',
  TRANSFER_EXECUTED_OL: 'transfer_executed_ol',
  TRANSFER_OUTGOING: 'transfer_outgoing',
}

// ── Read behaviour per type ────────────────────────────────────────
// 'action' — clears only when the recipient acts (accept/reject)
// 'view'   — clears when the recipient opens the relevant tab
export const NOTIFICATION_READ_BEHAVIOUR = {
  transfer_incoming: 'action',
  transfer_accepted: 'view',
  transfer_rejected: 'view',
  transfer_cancelled: 'view',
  transfer_executed_ol: 'view',
  transfer_outgoing: 'view',
}

// ── createNotification ─────────────────────────────────────────────
// Single function that writes one notification row.
// All notification creation in the app goes through this function.
export async function createNotification({
  orgId,
  recipientId,
  type,
  referenceId,
  referenceTable,
  message,
  createdById,
  createdByName,
}) {
  if (
    !orgId ||
    !recipientId ||
    !type ||
    !referenceId ||
    !referenceTable ||
    !message ||
    !createdById ||
    !createdByName
  ) {
    throw new Error('createNotification: missing required arguments')
  }

  const { error } = await supabase.from('notifications').insert({
    org_id: orgId,
    recipient_id: recipientId,
    type,
    reference_id: referenceId,
    reference_table: referenceTable,
    message,
    created_by_id: createdById,
    created_by_name: createdByName,
  })

  if (error) {
    console.error('notifications.createNotification error:', error)
    throw error
  }
}

// ── createManyNotifications ────────────────────────────────────────
// Batch insert for cases where multiple recipients need notifying
// from the same event (e.g. OL move notifies both managers).
export async function createManyNotifications(notifications) {
  if (!notifications || notifications.length === 0) return

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
      throw new Error(
        'createManyNotifications: missing required arguments in one or more entries'
      )
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
  }))

  const { error } = await supabase.from('notifications').insert(rows)

  if (error) {
    console.error('notifications.createManyNotifications error:', error)
    throw error
  }
}

// ── markAsRead ─────────────────────────────────────────────────────
// Marks a single notification as read by setting read_at.
// Only the recipient can mark their own notification as read
// (enforced at RLS level).
export async function markAsRead(notificationId) {
  if (!notificationId) {
    throw new Error('markAsRead: missing notificationId')
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null)

  if (error) {
    console.error('notifications.markAsRead error:', error)
    throw error
  }
}

// ── markManyAsRead ─────────────────────────────────────────────────
// Marks all unread notifications of specific types as read
// for the current user. Used when a tab is opened (view behaviour).
export async function markManyAsRead(recipientId, types) {
  if (!recipientId || !types || types.length === 0) {
    throw new Error('markManyAsRead: missing required arguments')
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .in('type', types)
    .is('read_at', null)

  if (error) {
    console.error('notifications.markManyAsRead error:', error)
    throw error
  }
}

// ── markReferenceAsRead ────────────────────────────────────────────
// Marks all unread notifications for a specific reference
// (e.g. a specific move request) as read for the current user.
// Used when an actionable notification is resolved (accept/reject).
export async function markReferenceAsRead(recipientId, referenceId) {
  if (!recipientId || !referenceId) {
    throw new Error('markReferenceAsRead: missing required arguments')
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .eq('reference_id', referenceId)
    .is('read_at', null)

  if (error) {
    console.error('notifications.markReferenceAsRead error:', error)
    throw error
  }
}

// ── fetchNotifications ─────────────────────────────────────────────
// Fetches all notifications for the current user.
// Used by RotaContext — not called directly from components.
export async function fetchNotifications(recipientId) {
  if (!recipientId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('notifications.fetchNotifications error:', error)
    return []
  }

  return data || []
}

// ── getUnreadCount ─────────────────────────────────────────────────
// Returns the count of unread notifications from a notifications array.
// Operates on the context array — no Supabase call.
export function getUnreadCount(notificationsArray) {
  if (!notificationsArray) return 0
  return notificationsArray.filter((n) => !n.read_at).length
}

// ── getUnreadCountByTypes ──────────────────────────────────────────
// Returns unread count filtered to specific types.
// Used by individual tabs to show their own badge count.
export function getUnreadCountByTypes(notificationsArray, types) {
  if (!notificationsArray || !types) return 0
  return notificationsArray.filter((n) => !n.read_at && types.includes(n.type))
    .length
}

// ── Transfer notification helpers ──────────────────────────────────
// One helper per transfer event. Called from staffMoves.js or
// directly from Staff.jsx handlers after a move action completes.
// Message is generated here — stored at write time for audit trail.

export async function notifyTransferIncoming({
  orgId,
  recipientId,
  requestId,
  staffName,
  fromHomeName,
  toHomeName,
  initiatedById,
  initiatedByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_INCOMING,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `${initiatedByName} has requested to transfer ${staffName} from ${fromHomeName} to ${toHomeName}.`,
    createdById: initiatedById,
    createdByName: initiatedByName,
  })
}

export async function notifyTransferAccepted({
  orgId,
  recipientId,
  requestId,
  staffName,
  toHomeName,
  reviewedById,
  reviewedByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_ACCEPTED,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `Your transfer request for ${staffName} to ${toHomeName} was accepted by ${reviewedByName}.`,
    createdById: reviewedById,
    createdByName: reviewedByName,
  })
}

export async function notifyTransferRejected({
  orgId,
  recipientId,
  requestId,
  staffName,
  toHomeName,
  reviewedById,
  reviewedByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_REJECTED,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `Your transfer request for ${staffName} to ${toHomeName} was rejected by ${reviewedByName}.`,
    createdById: reviewedById,
    createdByName: reviewedByName,
  })
}

export async function notifyTransferCancelled({
  orgId,
  recipientId,
  requestId,
  staffName,
  fromHomeName,
  cancelledById,
  cancelledByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_CANCELLED,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `The transfer request for ${staffName} from ${fromHomeName} has been cancelled by ${cancelledByName}.`,
    createdById: cancelledById,
    createdByName: cancelledByName,
  })
}

export async function notifyTransferExecutedOL({
  orgId,
  recipientId,
  requestId,
  staffName,
  fromHomeName,
  toHomeName,
  executedById,
  executedByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_EXECUTED_OL,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `${executedByName} has moved ${staffName} from ${fromHomeName} to ${toHomeName}.`,
    createdById: executedById,
    createdByName: executedByName,
  })
}

export async function notifyTransferOutgoing({
  orgId,
  recipientId,
  requestId,
  staffName,
  toHomeName,
  initiatedById,
  initiatedByName,
}) {
  await createNotification({
    orgId,
    recipientId,
    type: NOTIFICATION_TYPES.TRANSFER_OUTGOING,
    referenceId: requestId,
    referenceTable: 'staff_move_requests',
    message: `You have sent a transfer request for ${staffName} to ${toHomeName}. Waiting for approval.`,
    createdById: initiatedById,
    createdByName: initiatedByName,
  })
}

// ── fetchHomeManager ───────────────────────────────────────────────
// Fetches the active manager profile for a given home.
// Used when we need to notify a manager outside the current user's
// home — allStaff in Staff.jsx is scoped to the current home only.
export async function fetchHomeManager(homeId) {
  if (!homeId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, home, role')
    .eq('home', homeId)
    .eq('role', 'manager')
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error('notifications.fetchHomeManager error:', error)
    return null
  }

  return data || null
}
