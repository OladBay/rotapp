// src/components/layout/AppShell.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useRota } from '../../context/RotaContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getPendingRequestCount } from '../../utils/timeOffStorage'
import { getPendingCancelCount } from '../../utils/cancelRequests'
import {
  getUnreadCount,
  markAsRead,
  markManyAsRead,
} from '../../utils/notifications'
import SessionBanner from './SessionBanner'
import styles from './AppShell.module.css'

// ── Role display labels ────────────────────────────────────────
const ROLE_LABELS = {
  superadmin: 'Super Admin',
  operationallead: 'Op. Lead',
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'Care Worker',
  relief: 'Relief Staff',
}

// ── Avatar initials ────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Format notification timestamp ─────────────────────────────
function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Nav link definitions ───────────────────────────────────────
// Each link has iconOutline (inactive) and iconFilled (active)
function useNavLinks(user) {
  const canSeeManagement = [
    'manager',
    'deputy',
    'operationallead',
    'superadmin',
  ].includes(user?.activeRole)

  return [
    {
      path: '/dashboard',
      label: 'Dashboard',
      iconOutline: 'house',
      iconFilled: 'house',
      show: canSeeManagement,
    },
    {
      path: '/rota',
      label: 'Rota',
      iconOutline: 'clipboard-list',
      iconFilled: 'clipboard-list',
      show: canSeeManagement,
    },
    {
      path: '/staff',
      label: 'Manage Staff',
      iconOutline: 'user-group',
      iconFilled: 'user-group',
      show: canSeeManagement,
      badgeKey: 'staff',
    },
    {
      path: '/calendar',
      label: 'My Shifts',
      iconOutline: 'calendar-days',
      iconFilled: 'calendar-days',
      show: true,
    },
    {
      path: '/year-planner',
      label: 'Year Planner',
      iconOutline: 'calendar-plus',
      iconFilled: 'calendar-plus',
      show: true,
    },
    {
      path: '/account',
      label: 'Account',
      iconOutline: 'user',
      iconFilled: 'user',
      show: true,
    },
  ].filter((l) => l.show)
}

// ── Notification type icon ─────────────────────────────────────
function notifIcon(type) {
  const map = {
    leave: 'umbrella-beach',
    cancel: 'xmark',
    rota: 'clipboard-list',
    shift: 'calendar-days',
    system: 'circle-info',
  }
  return map[type] || 'bell'
}

// ── AppShell ───────────────────────────────────────────────────
function AppShell({ children }) {
  const { user, logout } = useAuth()
  const { theme } = useTheme()
  const { leaveRequests, cancelRequests, notifications, refreshNotifications } =
    useRota()
  const navigate = useNavigate()
  const location = useLocation()

  const navLinks = useNavLinks(user)
  const PRIMARY_COUNT = 4
  const primaryLinks = navLinks.slice(0, PRIMARY_COUNT)
  const overflowLinks = navLinks.slice(PRIMARY_COUNT)

  const pendingApprovals =
    getPendingRequestCount(leaveRequests) +
    getPendingCancelCount(cancelRequests)
  const unreadCount = getUnreadCount(notifications)

  const [notifOpen, setNotifOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const notifRef = useRef(null)
  const moreRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    setNotifOpen(false)
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleMarkAllRead = async () => {
    try {
      await markManyAsRead(
        user?.id,
        notifications.filter((n) => !n.read_at).map((n) => n.type)
      )
      if (refreshNotifications) refreshNotifications()
    } catch (e) {
      console.error('markAllRead error:', e)
    }
  }

  const handleNotifClick = async (notif) => {
    setNotifOpen(false)
    try {
      if (!notif.read_at) await markAsRead(notif.id)
      if (refreshNotifications) refreshNotifications()
    } catch (e) {
      console.error('markAsRead error:', e)
    }
    if (notif.link) navigate(notif.link)
  }

  const initials = getInitials(user?.name)

  return (
    <div className={styles.shell}>
      {/* ── SIDEBAR ───────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <span className={styles.logoText}>Rot</span>
          <span className={styles.logoAccent}>app</span>
        </div>

        {/* Primary nav links */}
        <nav className={styles.sidebarNav}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path
            const showBadge = link.badgeKey === 'staff' && pendingApprovals > 0
            return (
              <button
                key={link.path}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => navigate(link.path)}
              >
                <span className={styles.navIcon}>
                  <FontAwesomeIcon
                    icon={isActive ? link.iconFilled : link.iconOutline}
                  />
                </span>
                <span className={styles.navLabel}>{link.label}</span>
                {showBadge && (
                  <span className={styles.navBadge}>
                    {pendingApprovals > 9 ? '9+' : pendingApprovals}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Divider */}
        <div className={styles.sidebarDivider} />

        {/* Bottom utility links */}
        <div className={styles.sidebarBottom}>
          {/* Notifications */}
          <div className={styles.notifWrap} ref={notifRef}>
            <button
              className={`${styles.navItem} ${notifOpen ? styles.navItemActive : ''}`}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <span className={styles.navIcon}>
                <FontAwesomeIcon icon='bell' />
                {unreadCount > 0 && (
                  <span className={`${styles.iconBadge} ${styles.bellPulse}`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className={styles.navLabel}>Notifications</span>
            </button>

            {notifOpen && (
              <div className={styles.notifPanel}>
                <div className={styles.notifHeader}>
                  <span className={styles.notifTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      className={styles.markAllBtn}
                      onClick={handleMarkAllRead}
                    >
                      <FontAwesomeIcon icon='check-double' />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className={styles.notifList}>
                  {!notifications || notifications.length === 0 ? (
                    <div className={styles.notifEmpty}>
                      <FontAwesomeIcon
                        icon='bell'
                        className={styles.notifEmptyIcon}
                      />
                      <span>You're all caught up</span>
                    </div>
                  ) : (
                    [...notifications]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at) - new Date(a.created_at)
                      )
                      .slice(0, 20)
                      .map((notif) => (
                        <button
                          key={notif.id}
                          className={`${styles.notifItem} ${!notif.read_at ? styles.notifUnread : ''}`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <span className={styles.notifIcon}>
                            <FontAwesomeIcon icon={notifIcon(notif.type)} />
                          </span>
                          <span className={styles.notifBody}>
                            <span className={styles.notifMessage}>
                              {notif.message}
                            </span>
                            <span className={styles.notifTime}>
                              {formatTime(notif.created_at)}
                            </span>
                          </span>
                          {!notif.read_at && (
                            <span className={styles.unreadDot} />
                          )}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            className={`${styles.navItem} ${location.pathname === '/settings' ? styles.navItemActive : ''}`}
            onClick={() => navigate('/settings')}
          >
            <span className={styles.navIcon}>
              <FontAwesomeIcon icon='gear' />
            </span>
            <span className={styles.navLabel}>Settings</span>
          </button>

          {/* Logout */}
          <button
            className={`${styles.navItem} ${styles.navItemLogout}`}
            onClick={handleLogout}
          >
            <span className={styles.navIcon}>
              <FontAwesomeIcon icon='right-from-bracket' />
            </span>
            <span className={styles.navLabel}>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <div className={styles.main}>
        <SessionBanner />
        <div className={styles.content}>{children}</div>
      </div>

      {/* ── MOBILE TOP BAR ────────────────────────────────── */}
      <header
        className={`${styles.mobileTopBar} ${scrolled ? styles.mobileTopBarScrolled : ''}`}
      >
        <div className={styles.mobileTopLogo}>
          <span className={styles.logoText}>Rot</span>
          <span className={styles.logoAccent}>app</span>
        </div>
        <div className={styles.mobileTopRight}>
          <div className={styles.mobileNotifWrap} ref={notifRef}>
            <button
              className={`${styles.mobileIconBtn} ${notifOpen ? styles.mobileIconBtnActive : ''}`}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <FontAwesomeIcon icon='bell' />
              {unreadCount > 0 && (
                <span
                  className={`${styles.mobileIconBadge} ${styles.bellPulse}`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className={styles.mobileNotifPanel}>
                <div className={styles.notifHeader}>
                  <span className={styles.notifTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      className={styles.markAllBtn}
                      onClick={handleMarkAllRead}
                    >
                      <FontAwesomeIcon icon='check-double' />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className={styles.notifList}>
                  {!notifications || notifications.length === 0 ? (
                    <div className={styles.notifEmpty}>
                      <FontAwesomeIcon
                        icon='bell'
                        className={styles.notifEmptyIcon}
                      />
                      <span>You're all caught up</span>
                    </div>
                  ) : (
                    [...notifications]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at) - new Date(a.created_at)
                      )
                      .slice(0, 20)
                      .map((notif) => (
                        <button
                          key={notif.id}
                          className={`${styles.notifItem} ${!notif.read_at ? styles.notifUnread : ''}`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <span className={styles.notifIcon}>
                            <FontAwesomeIcon icon={notifIcon(notif.type)} />
                          </span>
                          <span className={styles.notifBody}>
                            <span className={styles.notifMessage}>
                              {notif.message}
                            </span>
                            <span className={styles.notifTime}>
                              {formatTime(notif.created_at)}
                            </span>
                          </span>
                          {!notif.read_at && (
                            <span className={styles.unreadDot} />
                          )}
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className={styles.mobileAvatar}>{initials}</div>
        </div>
      </header>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────── */}
      <nav className={styles.mobileTabBar}>
        {primaryLinks.map((link) => {
          const isActive = location.pathname === link.path
          const showBadge = link.badgeKey === 'staff' && pendingApprovals > 0
          return (
            <button
              key={link.path}
              className={`${styles.mobileTabItem} ${isActive ? styles.mobileTabItemActive : ''}`}
              onClick={() => navigate(link.path)}
            >
              <span className={styles.mobileTabIconWrap}>
                <FontAwesomeIcon
                  icon={isActive ? link.iconFilled : link.iconOutline}
                />
                {showBadge && (
                  <span className={styles.mobileTabBadge}>
                    {pendingApprovals > 9 ? '9+' : pendingApprovals}
                  </span>
                )}
              </span>
              <span className={styles.mobileTabLabel}>{link.label}</span>
            </button>
          )
        })}

        {overflowLinks.length > 0 && (
          <div className={styles.moreWrap} ref={moreRef}>
            <button
              className={`${styles.mobileTabItem} ${moreOpen ? styles.mobileTabItemActive : ''}`}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className={styles.mobileTabIconWrap}>
                <FontAwesomeIcon icon='ellipsis' />
              </span>
              <span className={styles.mobileTabLabel}>More</span>
            </button>
            {moreOpen && (
              <div className={styles.moreSheet}>
                <div className={styles.moreSheetHandle} />
                {overflowLinks.map((link) => {
                  const isActive = location.pathname === link.path
                  return (
                    <button
                      key={link.path}
                      className={`${styles.moreSheetItem} ${isActive ? styles.moreSheetItemActive : ''}`}
                      onClick={() => navigate(link.path)}
                    >
                      <span className={styles.moreSheetIcon}>
                        <FontAwesomeIcon
                          icon={isActive ? link.iconFilled : link.iconOutline}
                        />
                      </span>
                      <span className={styles.moreSheetLabel}>
                        {link.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  )
}

export default AppShell
