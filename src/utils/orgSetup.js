// src/utils/orgSetup.js
// ── Single owner of all org setup reads and writes ─────────────────────────
// All org wizard saves go through this file.
// No component or context writes to org_setup, orgs, or homes directly.

import { supabase } from '../lib/supabase'

// ── fetchOrgSetup ──────────────────────────────────────────────────────────
// Loads the org_setup record for a given org.
// Returns null if no setup record exists yet.
export async function fetchOrgSetup(orgId) {
  if (!orgId) return null

  const { data, error } = await supabase
    .from('org_setup')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('orgSetup.fetchOrgSetup error:', error)
    return null
  }

  return data || null
}

// ── initOrgSetup ───────────────────────────────────────────────────────────
// Creates a blank org_setup row when the wizard starts for the first time.
// Safe to call multiple times — uses upsert on org_id.
// NOTE: Only needed if you want to pre-create the row before any step save.
// saveOrgWizardStep handles creation automatically — prefer calling that.
export async function initOrgSetup(orgId) {
  if (!orgId) return null

  const { error } = await supabase.from('org_setup').upsert(
    {
      org_id: orgId,
      wizard_step: 0,
      is_complete: false,
      config: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id', ignoreDuplicates: true }
  )

  if (error) {
    console.error('orgSetup.initOrgSetup error:', error)
    return null
  }

  return true
}

// ── saveOrgWizardStep ──────────────────────────────────────────────────────
// Saves progress after each wizard step.
// Updates wizard_step to the highest completed step.
// Merges new config fields into existing config — never overwrites the whole blob.
// Creates the org_setup row if it doesn't exist yet — no prior init required.
export async function saveOrgWizardStep(orgId, completedStep, configUpdates) {
  if (!orgId) return

  // Read existing row — maybeSingle() returns null (not an error) if absent
  const { data: existing, error: fetchError } = await supabase
    .from('org_setup')
    .select('config, wizard_step')
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchError) {
    console.error('orgSetup.saveOrgWizardStep fetch error:', fetchError)
    throw fetchError
  }

  const currentStep = existing?.wizard_step || 0
  const currentConfig = existing?.config || {}

  // Upsert — creates row if absent, updates if present
  const { error } = await supabase.from('org_setup').upsert(
    {
      org_id: orgId,
      wizard_step: Math.max(currentStep, completedStep),
      is_complete: false,
      config: { ...currentConfig, ...configUpdates },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' }
  )

  if (error) {
    console.error('orgSetup.saveOrgWizardStep error:', error)
    throw error
  }
}

// ── createOrg ─────────────────────────────────────────────────────────────
// Creates the org row in the orgs table.
// Called on Step 1 save when no org exists yet.
export async function createOrg({
  name,
  careType,
  structure,
  orgCreatorRoleLabel,
}) {
  if (!name) return null

  const { data, error } = await supabase
    .from('orgs')
    .insert({
      name,
      care_type: careType,
      structure,
      org_creator_role_label: orgCreatorRoleLabel,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('orgSetup.createOrg error:', error)
    throw error
  }

  return data
}

// ── linkUserToOrg ──────────────────────────────────────────────────────────
// Stamps org_id onto the creator's profile after org is created.
export async function linkUserToOrg(userId, orgId) {
  if (!userId || !orgId) return

  const { error } = await supabase
    .from('profiles')
    .update({ org_id: orgId })
    .eq('id', userId)

  if (error) {
    console.error('orgSetup.linkUserToOrg error:', error)
    throw error
  }
}

// ── createHomeForOrg ──────────────────────────────────────────────────────
// Creates the home row under the org.
// Called on Finish when structure = 'single'.
// Returns the new home row including its UUID.
export async function createHomeForOrg({ name, orgId }) {
  if (!name || !orgId) return null

  const { data, error } = await supabase
    .from('homes')
    .insert({
      name,
      org_id: orgId,
    })
    .select()
    .single()

  if (error) {
    console.error('orgSetup.createHomeForOrg error:', error)
    throw error
  }

  return data
}

// ── linkUserToHome ─────────────────────────────────────────────────────────
// Stamps home_id onto the creator's profile.
// Only called when structure = 'single' AND creator is the home manager.
export async function linkUserToHome(userId, homeId) {
  if (!userId || !homeId) return

  const { error } = await supabase
    .from('profiles')
    .update({ home: homeId })
    .eq('id', userId)

  if (error) {
    console.error('orgSetup.linkUserToHome error:', error)
    throw error
  }
}

// ── completeOrgWizard ──────────────────────────────────────────────────────
// Called when org creator clicks Finish on the Review step.
// Sets is_complete = true and wizard_step = 4.
export async function completeOrgWizard(orgId) {
  if (!orgId) return

  const { error } = await supabase
    .from('org_setup')
    .update({
      is_complete: true,
      wizard_step: 4,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)

  if (error) {
    console.error('orgSetup.completeOrgWizard error:', error)
    throw error
  }
}
