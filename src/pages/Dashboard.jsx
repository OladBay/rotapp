// src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import { supabase } from '../lib/supabase'
import InviteModal from '../components/shared/InviteModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchHomes } from '../utils/homesData'
import AddHomeModal from '../components/shared/AddHomeModal'
import { useTopBarInit } from '../hooks/useTopBarInit'
import styles from './Dashboard.module.css'

// ── Apple Intelligence icon ────────────────────────────────────
function AIIcon() {
  return (
    <div className={styles.aiIconWrap}>
      <svg
        className={styles.aiIcon}
        viewBox='0 0 40 40'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <defs>
          <linearGradient id='aiGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
            <stop offset='0%' stopColor='#f97316' />
            <stop offset='25%' stopColor='#ec4899' />
            <stop offset='50%' stopColor='#8b5cf6' />
            <stop offset='75%' stopColor='#3b82f6' />
            <stop offset='100%' stopColor='#06b6d4' />
          </linearGradient>
        </defs>
        <path
          d='M20 4 C20 4, 36 12, 36 20 C36 28, 20 36, 20 36 C20 36, 4 28, 4 20 C4 12, 20 4, 20 4Z'
          stroke='url(#aiGrad)'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
        <path
          d='M20 4 C28 12, 36 20, 20 20 C4 20, 12 28, 20 36'
          stroke='url(#aiGrad)'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
        <path
          d='M20 4 C12 12, 4 20, 20 20 C36 20, 28 28, 20 36'
          stroke='url(#aiGrad)'
          strokeWidth='2.5'
          fill='none'
          strokeLinecap='round'
        />
      </svg>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────
function Dashboard() {
  const { user, logout, switchRole } = useAuth()
  const { monthRota } = useRota()
  const navigate = useNavigate()

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddHomeModal, setShowAddHomeModal] = useState(false)
  const [inviteDefaultHomeId, setInviteDefaultHomeId] = useState(null)
  const [homes, setHomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [aiSummary] = useState(
    "This week's rota is published with 2 unfilled shifts — both on Friday late. Next week is in draft. Consider filling gaps before Thursday."
  )

  const isOL = user?.activeRole === 'operationallead'
  const isAdmin = user?.activeRole === 'superadmin'
  const isManager = !isOL && !isAdmin

  const homeName = homes[0]?.name || ''

  // ── Fetch org name ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('orgs')
      .select('name')
      .eq('id', user.org_id)
      .single()
      .then(({ data }) => {
        if (data?.name) setOrgName(data.name)
      })
  }, [user?.org_id])

  // ── Top bar actions ────────────────────────────────────────
  useTopBarInit(
    isOL || isAdmin ? 'All Homes' : homeName || 'Dashboard',
    isOL || isAdmin
      ? `${homes.length} home${homes.length !== 1 ? 's' : ''} · ${orgName}`
      : `${homeName} · ${orgName}`,
    isManager ? (
      <button className={styles.topBarBtn} onClick={() => navigate('/rota')}>
        <FontAwesomeIcon icon='clipboard-list' /> View Rota
      </button>
    ) : (
      <div className={styles.headerActionGroup}>
        <button
          className={styles.groupSecondaryBtn}
          onClick={() => setShowAddHomeModal(true)}
        >
          <FontAwesomeIcon icon='plus' /> Add home
        </button>
        <div className={styles.groupDivider} />
        <button
          className={styles.groupPrimaryBtn}
          onClick={() => setShowInviteModal(true)}
        >
          <FontAwesomeIcon icon='user-group' /> Onboard staff
        </button>
      </div>
    )
  )

  // ── Fetch homes ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchHomes(user.activeRole, user.home, user.org_id).then((data) => {
      setHomes(data)
      setLoading(false)
    })
  }, [user])

  // ── OL stats ───────────────────────────────────────────────
  const totalGaps = homes.reduce((a, h) => a + (h.gaps || 0), 0)
  const homesWithCompliance = homes.filter((h) => h.compliance !== null)
  const avgCompliance = homesWithCompliance.length
    ? Math.round(
        homesWithCompliance.reduce((a, h) => a + h.compliance, 0) /
          homesWithCompliance.length
      )
    : null

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>Loading…</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* ── Rota Status placeholder — manager only ───────────
            Real status requires is_published column on
            rotapp_month_rota. Fix this when Flow 3C lands.     */}
        {isManager && (
          <div className={styles.rotaStatusSection}>
            <div className={styles.sectionLabel}>Rota Status</div>
            <div className={styles.rotaStatusPlaceholder}>
              <FontAwesomeIcon
                icon='clock'
                className={styles.placeholderIcon}
              />
              <div>
                <div className={styles.placeholderTitle}>
                  Rota status coming soon
                </div>
                <div className={styles.placeholderText}>
                  Week-by-week publish status will appear here once your first
                  rota is published.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary stats — OL and admin only ───────────────── */}
        {(isOL || isAdmin) && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statVal}>{homes.length}</div>
              <div className={styles.statLabel}>Total homes</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statVal}>{totalGaps}</div>
              <div
                className={styles.statLabel}
                style={{
                  color:
                    totalGaps > 0
                      ? 'var(--color-danger)'
                      : 'var(--color-success)',
                }}
              >
                Open gaps
              </div>
            </div>
            <div className={styles.statCard}>
              <div
                className={styles.statVal}
                style={{
                  color:
                    avgCompliance === null
                      ? 'var(--text-secondary)'
                      : avgCompliance < 80
                        ? 'var(--color-danger)'
                        : 'var(--color-success)',
                }}
              >
                {avgCompliance !== null ? `${avgCompliance}%` : '—'}
              </div>
              <div className={styles.statLabel}>Avg compliance</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statVal}>
                {homes.reduce((a, h) => a + (h.totalStaff || 0), 0)}
              </div>
              <div className={styles.statLabel}>Total staff</div>
            </div>
          </div>
        )}

        {/* ── Section label ────────────────────────────────────── */}
        <div className={styles.sectionLabel}>
          {isOL || isAdmin ? 'Homes Overview' : 'Your Home'}
        </div>

        {/* ── Homes list ───────────────────────────────────────── */}
        <div className={styles.homesList}>
          {homes.map((home) => (
            <div key={home.id} className={styles.homeCard}>
              <div className={styles.homeTop}>
                <div>
                  <div className={styles.homeName}>{home.name}</div>
                  {(isOL || isAdmin) && (
                    <div className={styles.homeMeta}>
                      {home.manager} · {home.deputy}
                    </div>
                  )}
                </div>
                <div
                  className={styles.compBadge}
                  style={{
                    background:
                      home.compliance === null
                        ? 'var(--bg-overlay)'
                        : home.compliance >= 90
                          ? 'var(--color-success-bg)'
                          : home.compliance >= 75
                            ? 'var(--color-warning-bg)'
                            : 'var(--color-danger-bg)',
                    color:
                      home.compliance === null
                        ? 'var(--text-secondary)'
                        : home.compliance >= 90
                          ? 'var(--color-success)'
                          : home.compliance >= 75
                            ? 'var(--color-warning)'
                            : 'var(--color-danger)',
                  }}
                >
                  {home.compliance !== null
                    ? `${home.compliance}% compliant`
                    : '— compliance'}
                </div>
              </div>

              <div className={styles.homeStats}>
                <div className={styles.homeStat}>
                  <span className={styles.homeStatVal}>{home.totalStaff}</span>
                  <span className={styles.homeStatLabel}>Total staff</span>
                </div>
                <div className={styles.homeStat}>
                  <span className={styles.homeStatVal}>
                    {home.shiftsThisWeek}
                  </span>
                  <span className={styles.homeStatLabel}>Shifts this week</span>
                </div>
                <div className={styles.homeStat}>
                  <span
                    className={styles.homeStatVal}
                    style={{
                      color:
                        home.gaps > 0
                          ? 'var(--color-danger)'
                          : 'var(--color-success)',
                    }}
                  >
                    {home.gaps}
                  </span>
                  <span className={styles.homeStatLabel}>Open gaps</span>
                </div>
                <div className={styles.homeStat}>
                  <span className={styles.homeStatVal}>
                    {home.staffOnShiftToday ?? '—'}
                  </span>
                  <span className={styles.homeStatLabel}>On shift today</span>
                </div>
              </div>

              {/* OL step-in action */}
              {(isOL || isAdmin) && (
                <div className={styles.homeActions}>
                  <button
                    className={styles.ghostBtn}
                    onClick={() => {
                      switchRole('manager', home.id)
                      navigate('/rota')
                    }}
                  >
                    Step in as manager →
                  </button>
                </div>
              )}

              {/* AI summary — manager only */}
              {isManager && (
                <div className={styles.aiSummary}>
                  <AIIcon />
                  <p className={styles.aiText}>{aiSummary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => {
            setShowInviteModal(false)
            setInviteDefaultHomeId(null)
          }}
          defaultHomeId={inviteDefaultHomeId}
          homes={homes}
        />
      )}

      {showAddHomeModal && (
        <AddHomeModal
          orgId={user.org_id}
          onClose={(action, newHome) => {
            setShowAddHomeModal(false)
            if (action === 'onboard' && newHome) {
              setInviteDefaultHomeId(newHome.id)
              setShowInviteModal(true)
            }
          }}
          onHomeCreated={() => {
            fetchHomes(user.activeRole, user.home, user.org_id).then(setHomes)
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
