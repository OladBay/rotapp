import { supabase } from '../lib/supabase'

// Roles a Manager can invite
export const MANAGER_INVITE_ROLES = ['deputy', 'senior', 'rcw']

// Roles an OL or Admin can invite
export const OL_INVITE_ROLES = ['manager', 'relief', 'deputy', 'senior', 'rcw']

export const ROLE_LABELS = {
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'Residential Care Worker (RCW)',
  relief: 'Relief / Bank Staff',
}

// Generate a new invite token
export async function createInviteToken({
  homeId,
  role,
  invitedById,
  invitedByName,
}) {
  const { data, error } = await supabase
    .from('invite_tokens')
    .insert({
      home_id: homeId || null,
      role,
      invited_by: invitedById,
      invited_by_name: invitedByName,
    })
    .select('token')
    .single()

  if (error) throw error
  return data.token
}

// Fetch and validate a token (called on the invite page)
export async function fetchInviteToken(token) {
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) return { valid: false, reason: 'Token not found' }
  if (data.used_at)
    return { valid: false, reason: 'This invite link has already been used' }
  if (new Date(data.expires_at) < new Date())
    return { valid: false, reason: 'This invite link has expired' }

  return { valid: true, tokenData: data }
}

// Mark a token as used after successful signup
export async function markTokenUsed(token, userId) {
  const { error } = await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('token', token)

  if (error) throw error
}
