import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import InviteModal from '../components/shared/InviteModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchHomes } from '../utils/homesData'
import AddHomeModal from '../components/shared/AddHomeModal'
import styles from './Dashboard.module.css'

function Dashboard() {
  const { user, switchRole } = useAuth()
  const navigate = useNavigate()

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddHomeModal, setShowAddHomeModal] = useState(false)
  const [inviteDefaultHomeId, setInviteDefaultHomeId] = useState(null)
  const [homes, setHomes] = useState([])
  const [loading, setLoading] = useState(true)

  const isOL = user?.activeRole === 'operationallead'
  const isAdmin = user?.activeRole === 'superadmin'

  useEffect(() => {
    if (!user) return
    fetchHomes(user.activeRole, user.home, user.org_id).then((data) => {
      setHomes(data)
      setLoading(false)
    })
  }, [user])

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
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {isOL || isAdmin ? 'All Homes' : homes[0]?.name || 'Your Home'}
            </h1>
            <p className={styles.subtitle}>
              {isOL || isAdmin
                ? `${homes.length} home${homes.length !== 1 ? 's' : ''}`
                : `Coventry City Council`}
            </p>
          </div>
          {!isOL && !isAdmin && (
            <button
              className={styles.primaryBtn}
              onClick={() => navigate('/rota')}
            >
              View Rota →
            </button>
          )}

          {(isOL || isAdmin) && (
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
          )}
        </div>

        {/* Summary stats — OL and admin only */}
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
        {/* Homes list */}
        <div className={styles.sectionLabel}>
          {isOL || isAdmin ? 'Homes Overview' : 'Your Home'}
        </div>

        <div className={styles.homesList}>
          {homes.map((home) => (
            <div key={home.id} className={styles.homeCard}>
              <div className={styles.homeTop}>
                <div>
                  <div className={styles.homeName}>{home.name}</div>
                  <div className={styles.homeMeta}>
                    {home.manager} · {home.deputy}
                  </div>
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
                  <span className={styles.homeStatLabel}>Staff</span>
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
              </div>

              <div className={styles.homeActions}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => navigate('/rota')}
                >
                  View rota
                </button>

                {(isOL || isAdmin) && (
                  <button
                    className={styles.ghostBtn}
                    onClick={() => {
                      switchRole('manager', home.id)
                      navigate('/rota')
                    }}
                  >
                    Step in as manager →
                  </button>
                )}
              </div>
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
