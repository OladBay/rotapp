// src/pages/ManageHome.jsx
import { useAuth } from '../context/AuthContext'
import { useHomeConfig } from '../context/HomeConfigContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTopBarInit } from '../hooks/useTopBarInit'
import styles from './ManageHome.module.css'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  operationallead: 'Operational Lead',
  manager: 'Manager',
  deputy: 'Deputy Manager',
}

// ── Format management schedule value ──────────────────────────
function formatMgmtRole(role) {
  if (!role?.differentSchedule) return 'Works regular shifts'
  const days = (role.workingDays || [])
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join(', ')
  if (role.sameTimeAllDays) {
    return `${days} · ${role.startTime}–${role.endTime}`
  }
  return `${days} · Variable hours`
}

// ── Field row with title + description ────────────────────────
function ConfigField({ icon, label, description, value }) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLeft}>
        {icon && <FontAwesomeIcon icon={icon} className={styles.fieldIcon} />}
        <div className={styles.fieldText}>
          <div className={styles.fieldLabel}>{label}</div>
          {description && <div className={styles.fieldDesc}>{description}</div>}
        </div>
      </div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  )
}

function ManageHome() {
  const { user } = useAuth()
  const {
    homeConfig,
    homeShifts,
    homeShiftRules,
    homeName,
    configLoading,
    config,
  } = useHomeConfig()

  if (configLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          Loading home configuration…
        </div>
      </div>
    )
  }

  if (!homeConfig) {
    return (
      <div className={styles.page}>
        <div className={styles.body}>
          <div className={styles.header}>
            <h1 className={styles.title}>Manage Home</h1>
          </div>
          <div className={styles.emptyState}>
            <FontAwesomeIcon icon='circle-info' className={styles.emptyIcon} />
            <p>
              No home configuration found. Complete the Home Setup Wizard first.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const managementSchedule = config.managementSchedule || {}
  const sleepIn = config.sleepIn || {}
  const roleExclusions = config.roleExclusions || {}
  const seniority = config.seniority || {}
  const softRules = config.softRules || {}
  const rotaSchedule = config.rotaSchedule || {}
  const shiftCoordinator = config.shiftCoordinator ?? false

  useTopBarInit(
    'Manage Home',
    `${homeName || '—'} · Home configuration and shift settings`
  )

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerBadge}>
            <FontAwesomeIcon icon='circle-info' />
            Read only — editing coming soon
          </div>
        </div>

        {/* ── Section 1: Home details ──────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Home details</div>
          <div className={styles.card}>
            <ConfigField
              icon='house'
              label='Home name'
              description='The name used across the app and on rotas'
              value={homeName || '—'}
            />
            <div className={styles.fieldDivider} />
            <ConfigField
              icon='user'
              label='Your role'
              description='Your current active role in this home'
              value={ROLE_LABELS[user?.activeRole] || user?.activeRole}
            />
            <div className={styles.fieldDivider} />
            <ConfigField
              icon='calendar-days'
              label='Rota period'
              description='How rotas are grouped — weekly or monthly'
              value={
                config.periodType === 'week'
                  ? 'Week by week'
                  : config.periodType === 'month'
                    ? 'Month by month'
                    : '—'
              }
            />
          </div>
        </div>

        {/* ── Section 2: Shift patterns ────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Shift patterns</div>
          <p className={styles.sectionDesc}>
            The shifts your staff are rostered on. Times and sleep-in
            eligibility are set here.
          </p>
          {homeShifts.length === 0 ? (
            <div className={styles.emptySection}>No shifts configured.</div>
          ) : (
            <div className={styles.card}>
              {homeShifts.map((shift, idx) => (
                <div key={shift.id}>
                  {idx > 0 && <div className={styles.fieldDivider} />}
                  <div className={styles.shiftRow}>
                    <div className={styles.shiftName}>{shift.name}</div>
                    <div className={styles.shiftMeta}>
                      <span className={styles.shiftTime}>
                        {shift.start_time} – {shift.end_time}
                      </span>
                      <span className={styles.shiftHours}>{shift.hours}h</span>
                      {shift.sleep_in_eligible && (
                        <span className={styles.sleepInBadge}>
                          Sleep-in eligible
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Staffing numbers ──────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Staffing numbers</div>
          <p className={styles.sectionDesc}>
            Minimum and ideal staff counts per shift. The rota generator uses
            these to check whether shifts are adequately covered.
          </p>
          {homeShiftRules.length === 0 ? (
            <div className={styles.emptySection}>
              No staffing rules configured.
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.staffingHeader}>
                <span>Shift</span>
                <span>Weekday min</span>
                <span>Weekday ideal</span>
                <span>Weekend min</span>
                <span>Weekend ideal</span>
              </div>
              {homeShiftRules.map((rule, idx) => {
                const shift = homeShifts.find((s) => s.id === rule.shift_id)
                return (
                  <div key={rule.id}>
                    {idx > 0 && <div className={styles.fieldDivider} />}
                    <div className={styles.staffingRow}>
                      <span className={styles.staffingShiftName}>
                        {shift?.name || '—'}
                      </span>
                      <span>{rule.weekday_min}</span>
                      <span>{rule.weekday_ideal}</span>
                      <span>
                        {rule.same_for_weekend
                          ? rule.weekday_min
                          : rule.weekend_min}
                      </span>
                      <span>
                        {rule.same_for_weekend
                          ? rule.weekday_ideal
                          : rule.weekend_ideal}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Section 4: Management schedule ───────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Management schedule</div>
          <p className={styles.sectionDesc}>
            Whether your manager and deputy work regular shifts alongside staff,
            or have a separate office schedule.
          </p>
          <div className={styles.card}>
            <ConfigField
              icon='user'
              label='Manager schedule'
              description='Does the manager work regular care shifts or a separate office schedule?'
              value={formatMgmtRole(managementSchedule.manager)}
            />
            <div className={styles.fieldDivider} />
            <ConfigField
              icon='user'
              label='Deputy Manager schedule'
              description='Does the deputy work regular care shifts or a separate office schedule?'
              value={formatMgmtRole(managementSchedule.deputy)}
            />
          </div>
        </div>

        {/* ── Section 5: Sleep-in ───────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sleep-in</div>
          <p className={styles.sectionDesc}>
            Sleep-in is when a staff member stays overnight on call. It is
            separate from a night shift.
          </p>
          <div className={styles.card}>
            <ConfigField
              icon='clock'
              label='Sleep-in used at this home'
              description='Whether the rota generator assigns sleep-in duties'
              value={sleepIn.enabled ? 'Yes' : 'No'}
            />
            {sleepIn.enabled && (
              <>
                <div className={styles.fieldDivider} />
                <ConfigField
                  icon='clock'
                  label='Maximum sleep-ins per night'
                  description='How many staff can be assigned sleep-in on the same night'
                  value={sleepIn.maxPerNight ?? '—'}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Section 6: Staffing rules ─────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Staffing rules</div>
          <p className={styles.sectionDesc}>
            Which roles count toward your minimum staffing numbers when the rota
            is checked for compliance.
          </p>
          <div className={styles.card}>
            {[
              { key: 'manager', label: 'Manager' },
              { key: 'deputy', label: 'Deputy Manager' },
              { key: 'senior', label: 'Senior Carer' },
              { key: 'rcw', label: 'Residential Care Worker' },
              { key: 'relief', label: 'Relief / Bank Staff' },
            ].map((role, idx) => (
              <div key={role.key}>
                {idx > 0 && <div className={styles.fieldDivider} />}
                <ConfigField
                  label={role.label}
                  description='Counts toward shift minimum when rostered'
                  value={
                    roleExclusions[role.key] ? (
                      <span className={styles.badgeOn}>Counted</span>
                    ) : (
                      <span className={styles.badgeOff}>Not counted</span>
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 7: Shift coordinator ─────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Shift coordinator</div>
          <div className={styles.card}>
            <ConfigField
              icon='bolt'
              label='Shift coordinator'
              description='One staff member auto-assigned as shift lead per shift.'
              value={shiftCoordinator ? 'Yes' : 'No'}
            />
          </div>
        </div>

        {/* ── Section 8: Seniority ─────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Seniority</div>
          <p className={styles.sectionDesc}>
            Whether a Senior Carer must be present on every shift. This is a
            soft rule — flagged but never blocking.
          </p>
          <div className={styles.card}>
            <ConfigField
              icon='list-check'
              label='Senior required on every shift'
              description='The generator will try to ensure a Senior is present on every shift'
              value={seniority.required ? 'Yes' : 'No'}
            />
            {seniority.required && (
              <>
                <div className={styles.fieldDivider} />
                <ConfigField
                  icon='list-check'
                  label='Seniors required per shift'
                  description='Minimum number of Seniors the generator aims for per shift'
                  value={
                    seniority.countPerShift != null
                      ? `${seniority.countPerShift} per shift`
                      : '—'
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* ── Section 9: Soft rules ─────────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Soft rules</div>
          <p className={styles.sectionDesc}>
            Preferences the rota generator tries to respect. These are not hard
            requirements — violations are flagged but don't block the rota.
          </p>
          <div className={styles.card}>
            <ConfigField
              icon='venus-mars'
              label='Female staff on every shift'
              description='The generator will try to ensure at least one female staff member per shift'
              value={softRules.femalePerShift ? 'Yes' : 'No'}
            />
            <div className={styles.fieldDivider} />
            <ConfigField
              icon='car'
              label='Driver on every shift'
              description='The generator will try to ensure at least one certified driver per shift'
              value={softRules.driverPerShift ? 'Yes' : 'No'}
            />
            {sleepIn.enabled && (
              <>
                <div className={styles.fieldDivider} />
                <ConfigField
                  icon='clock'
                  label='Sleep-in follow-through'
                  description='Staff who do a late shift with sleep-in should ideally work the following early shift'
                  value={softRules.sleepInFollowThrough ? 'Yes' : 'No'}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Section 10: Rota reminders ────────────────────── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Rota reminders</div>
          <p className={styles.sectionDesc}>
            How far in advance you'll be reminded to generate and publish your
            rota if you haven't done it yet.
          </p>
          <div className={styles.card}>
            <ConfigField
              icon='calendar-days'
              label='Generate reminder'
              description='Reminds you to generate the rota this many weeks before the period starts'
              value={
                rotaSchedule.generateWeeksBefore != null
                  ? `${rotaSchedule.generateWeeksBefore} ${rotaSchedule.generateWeeksBefore === 1 ? 'week' : 'weeks'} before`
                  : '—'
              }
            />
            <div className={styles.fieldDivider} />
            <ConfigField
              icon='calendar-plus'
              label='Publish reminder'
              description='Reminds you to publish the rota this many weeks before the period starts'
              value={
                rotaSchedule.publishWeeksBefore != null
                  ? `${rotaSchedule.publishWeeksBefore} ${rotaSchedule.publishWeeksBefore === 1 ? 'week' : 'weeks'} before`
                  : '—'
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManageHome
