// src/utils/homeConfig.js
// ── Single owner of all home config reads and writes ───────────────────────
// All wizard saves go through this file.
// No component or context writes to home_config, home_shifts,
// or home_shift_rules directly.

import { supabase } from '../lib/supabase'

// ── calculateHours ─────────────────────────────────────────────────────────
// Calculates hours between two time strings (HH:MM).
// Handles overnight shifts (e.g. 22:00 → 07:00).
export function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins <= startMins) endMins += 24 * 60
  return Math.round(((endMins - startMins) / 60) * 100) / 100
}

// ── fetchHomeConfig ────────────────────────────────────────────────────────
// Loads the full home config for a given home.
// Returns null if no config exists yet (wizard not started).
export async function fetchHomeConfig(homeId) {
  if (!homeId) return null

  const { data, error } = await supabase
    .from('home_config')
    .select('*')
    .eq('home_id', homeId)
    .maybeSingle()

  if (error) {
    console.error('homeConfig.fetchHomeConfig error:', error)
    return null
  }

  return data || null
}

// ── fetchHomeShifts ────────────────────────────────────────────────────────
// Loads all shifts for a given home, ordered by sort_order.
export async function fetchHomeShifts(homeId) {
  if (!homeId) return []

  const { data, error } = await supabase
    .from('home_shifts')
    .select('*')
    .eq('home_id', homeId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('homeConfig.fetchHomeShifts error:', error)
    return []
  }

  return data || []
}

// ── fetchHomeShiftRules ────────────────────────────────────────────────────
// Loads all shift rules for a given home.
export async function fetchHomeShiftRules(homeId) {
  if (!homeId) return []

  const { data, error } = await supabase
    .from('home_shift_rules')
    .select('*')
    .eq('home_id', homeId)

  if (error) {
    console.error('homeConfig.fetchHomeShiftRules error:', error)
    return []
  }

  return data || []
}

// ── initHomeConfig ─────────────────────────────────────────────────────────
// Creates a blank home_config row when the wizard starts for the first time.
// Safe to call multiple times — uses upsert on home_id.
export async function initHomeConfig(homeId, orgId) {
  if (!homeId || !orgId) return null

  const { data, error } = await supabase
    .from('home_config')
    .upsert(
      {
        home_id: homeId,
        org_id: orgId,
        wizard_step: 0,
        is_complete: false,
        config: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'home_id', ignoreDuplicates: true }
    )
    .select()
    .single()

  if (error) {
    console.error('homeConfig.initHomeConfig error:', error)
    return null
  }

  return data
}

// ── saveWizardStep ─────────────────────────────────────────────────────────
// Saves progress after each wizard step.
// Updates wizard_step to the highest completed step.
// Merges new config fields into existing config — never overwrites the whole blob.
export async function saveWizardStep(homeId, completedStep, configUpdates) {
  if (!homeId) return

  // First read current config so we can merge
  const { data: existing, error: fetchError } = await supabase
    .from('home_config')
    .select('config, wizard_step')
    .eq('home_id', homeId)
    .single()

  if (fetchError) {
    console.error('homeConfig.saveWizardStep fetch error:', fetchError)
    throw fetchError
  }

  const currentStep = existing?.wizard_step || 0
  const currentConfig = existing?.config || {}

  const { error } = await supabase
    .from('home_config')
    .update({
      wizard_step: Math.max(currentStep, completedStep),
      config: { ...currentConfig, ...configUpdates },
      updated_at: new Date().toISOString(),
    })
    .eq('home_id', homeId)

  if (error) {
    console.error('homeConfig.saveWizardStep error:', error)
    throw error
  }
}

// ── saveShifts ─────────────────────────────────────────────────────────────
// Saves shifts for a home after Step 2.
// Full replace — deletes existing shifts for this home and reinserts.
// Also deletes orphaned shift_rules via CASCADE.
// Returns the newly created shift rows (with their UUIDs).
export async function saveShifts(homeId, orgId, shifts) {
  if (!homeId || !orgId || !shifts?.length) return []

  // Delete existing shifts — cascade deletes shift_rules automatically
  const { error: deleteError } = await supabase
    .from('home_shifts')
    .delete()
    .eq('home_id', homeId)

  if (deleteError) {
    console.error('homeConfig.saveShifts delete error:', deleteError)
    throw deleteError
  }

  // Insert new shifts
  const rows = shifts.map((s, index) => ({
    home_id: homeId,
    org_id: orgId,
    name: s.name.trim(),
    start_time: s.startTime,
    end_time: s.endTime,
    hours: calculateHours(s.startTime, s.endTime),
    sort_order: index,
    updated_at: new Date().toISOString(),
  }))

  const { data, error: insertError } = await supabase
    .from('home_shifts')
    .insert(rows)
    .select()

  if (insertError) {
    console.error('homeConfig.saveShifts insert error:', insertError)
    throw insertError
  }

  return data || []
}

// ── saveShiftRules ─────────────────────────────────────────────────────────
// Saves staffing numbers and sleep-in eligibility for each shift.
// Called after Step 5 (staffing numbers) and Step 4 (sleep-in).
// Full replace per home — deletes and reinserts.
// shiftRules is an array of:
// { shiftId, weekdayMin, weekdayIdeal, weekendMin, weekendIdeal,
//   sameForWeekend, sleepInEligible }
export async function saveShiftRules(homeId, orgId, shiftRules) {
  if (!homeId || !orgId || !shiftRules?.length) return

  // Delete existing rules for this home
  const { error: deleteError } = await supabase
    .from('home_shift_rules')
    .delete()
    .eq('home_id', homeId)

  if (deleteError) {
    console.error('homeConfig.saveShiftRules delete error:', deleteError)
    throw deleteError
  }

  const rows = shiftRules.map((r) => ({
    shift_id: r.shiftId,
    home_id: homeId,
    org_id: orgId,
    weekday_min: r.weekdayMin,
    weekday_ideal: r.weekdayIdeal,
    weekend_min: r.weekendMin,
    weekend_ideal: r.weekendIdeal,
    same_for_weekend: r.sameForWeekend,
    sleep_in_eligible: r.sleepInEligible,
    updated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase
    .from('home_shift_rules')
    .insert(rows)

  if (insertError) {
    console.error('homeConfig.saveShiftRules insert error:', insertError)
    throw insertError
  }
}

// ── completeWizard ─────────────────────────────────────────────────────────
// Called when manager clicks Finish on the Review step.
// Sets is_complete = true and wizard_step = 11.
export async function completeWizard(homeId) {
  if (!homeId) return

  const { error } = await supabase
    .from('home_config')
    .update({
      is_complete: true,
      wizard_step: 11,
      updated_at: new Date().toISOString(),
    })
    .eq('home_id', homeId)

  if (error) {
    console.error('homeConfig.completeWizard error:', error)
    throw error
  }
}
