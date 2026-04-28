// src/utils/avatarUtils.js
import { supabase } from '../lib/supabase'

// ── Get avatar URL ─────────────────────────────────────────────
// Returns uploaded photo if available, Fontawesome fallback if not
export function getAvatarUrl(user) {
  return user?.avatar_url || null
}

// ── Upload avatar ──────────────────────────────────────────────
// Uploads image to Supabase storage and updates profile avatar_url
export async function uploadAvatar(userId, file) {
  if (!userId || !file) throw new Error('Missing userId or file')

  // Validate file type
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPG, PNG and WEBP images are allowed')
  }

  // Validate file size — 5MB max
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5MB')
  }

  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`

  // Upload to storage — upsert so repeated uploads replace the old one
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw uploadError

  // Get public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)

  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) throw updateError

  return publicUrl
}

// ── Remove avatar ──────────────────────────────────────────────
// Deletes uploaded photo and clears avatar_url on profile
export async function removeAvatar(userId, currentAvatarUrl) {
  if (!userId) throw new Error('Missing userId')

  if (currentAvatarUrl) {
    // Extract path from URL
    const url = new URL(currentAvatarUrl)
    const path = url.pathname.split('/avatars/')[1]?.split('?')[0]
    if (path) {
      await supabase.storage.from('avatars').remove([path])
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)

  if (error) throw error
}
