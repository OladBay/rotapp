import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import InviteModal from '../components/shared/InviteModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchHomes } from '../utils/homesData'

function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showInviteModal, setShowInviteModal] = useState(false)
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
      <div style={styles.page}>
        <Navbar />
        <div style={styles.loadingWrap}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <Navbar />

      <div style={styles.body}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              {isOL || isAdmin ? 'All Homes' : homes[0]?.name || 'Your Home'}
            </h1>
            <p style={styles.subtitle}>
              {isOL || isAdmin
                ? `${homes.length} home${homes.length !== 1 ? 's' : ''}`
                : `Coventry City Council`}
            </p>
          </div>
          {!isOL && !isAdmin && (
            <button style={styles.primaryBtn} onClick={() => navigate('/rota')}>
              View Rota →
            </button>
          )}
          {(isOL || isAdmin) && (
            <button
              style={styles.primaryBtn}
              onClick={() => setShowInviteModal(true)}
            >
              <FontAwesomeIcon icon='envelope' /> Onboard staff
            </button>
          )}
        </div>

        {/* Summary stats — OL and admin only */}
        {(isOL || isAdmin) && (
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statVal}>{homes.length}</div>
              <div style={styles.statLabel}>Total homes</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statVal}>{totalGaps}</div>
              <div
                style={{
                  ...styles.statLabel,
                  color: totalGaps > 0 ? '#e85c3d' : '#2ecc8a',
                }}
              >
                Open gaps
              </div>
            </div>
            <div style={styles.statCard}>
              <div
                style={{
                  ...styles.statVal,
                  color:
                    avgCompliance === null
                      ? '#9499b0'
                      : avgCompliance < 80
                        ? '#e85c3d'
                        : '#2ecc8a',
                }}
              >
                {avgCompliance !== null ? `${avgCompliance}%` : '—'}
              </div>
              <div style={styles.statLabel}>Avg compliance</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statVal}>
                {homes.reduce((a, h) => a + (h.totalStaff || 0), 0)}
              </div>
              <div style={styles.statLabel}>Total staff</div>
            </div>
          </div>
        )}

        {/* Homes list */}
        <div style={styles.sectionLabel}>
          {isOL || isAdmin ? 'Homes Overview' : 'Your Home'}
        </div>

        <div style={styles.homesList}>
          {homes.map((home) => (
            <div key={home.id} style={styles.homeCard}>
              <div style={styles.homeTop}>
                <div>
                  <div style={styles.homeName}>{home.name}</div>
                  <div style={styles.homeMeta}>
                    {home.manager} · {home.deputy}
                  </div>
                </div>
                <div
                  style={{
                    ...styles.compBadge,
                    background:
                      home.compliance === null
                        ? 'rgba(148,153,176,0.1)'
                        : home.compliance >= 90
                          ? 'rgba(46,204,138,0.12)'
                          : home.compliance >= 75
                            ? 'rgba(196,136,58,0.12)'
                            : 'rgba(232,92,61,0.12)',
                    color:
                      home.compliance === null
                        ? '#9499b0'
                        : home.compliance >= 90
                          ? '#2ecc8a'
                          : home.compliance >= 75
                            ? '#c4883a'
                            : '#e85c3d',
                  }}
                >
                  {home.compliance !== null
                    ? `${home.compliance}% compliant`
                    : '— compliance'}
                </div>
              </div>

              <div style={styles.homeStats}>
                <div style={styles.homeStat}>
                  <span style={styles.homeStatVal}>{home.totalStaff}</span>
                  <span style={styles.homeStatLabel}>Staff</span>
                </div>
                <div style={styles.homeStat}>
                  <span style={styles.homeStatVal}>{home.shiftsThisWeek}</span>
                  <span style={styles.homeStatLabel}>Shifts this week</span>
                </div>
                <div style={styles.homeStat}>
                  <span
                    style={{
                      ...styles.homeStatVal,
                      color: home.gaps > 0 ? '#e85c3d' : '#2ecc8a',
                    }}
                  >
                    {home.gaps}
                  </span>
                  <span style={styles.homeStatLabel}>Open gaps</span>
                </div>
              </div>

              <div style={styles.homeActions}>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => navigate('/rota')}
                >
                  View rota
                </button>
                {(isOL || isAdmin) && (
                  <button
                    style={styles.ghostBtn}
                    onClick={() => navigate('/rota')}
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
          onClose={() => setShowInviteModal(false)}
          defaultHomeId={null}
          homes={homes}
        />
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1117',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#9499b0',
    fontSize: '14px',
  },
  body: { padding: '28px 24px', maxWidth: '960px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '28px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '-0.3px',
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '28px',
  },
  statCard: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '16px',
  },
  statVal: {
    fontSize: '26px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  statLabel: { fontSize: '12px', color: '#9499b0', marginTop: '4px' },
  sectionLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#5d6180',
    marginBottom: '12px',
    fontWeight: 500,
  },
  homesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  homeCard: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    padding: '20px',
  },
  homeTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  homeName: { fontSize: '15px', fontWeight: 500, color: '#e8eaf0' },
  homeMeta: { fontSize: '12px', color: '#9499b0', marginTop: '3px' },
  compBadge: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: '6px',
  },
  homeStats: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  homeStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  homeStatVal: {
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  homeStatLabel: { fontSize: '11px', color: '#9499b0' },
  homeActions: { display: 'flex', gap: '8px' },
  primaryBtn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#9499b0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  ghostBtn: {
    background: 'transparent',
    color: '#6c8fff',
    border: 'none',
    padding: '7px 0',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default Dashboard
