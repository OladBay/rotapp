import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { mockStaff } from '../../data/mockRota'

function CellEditModal({ day, shift, staffList, onClose, onSave, staffMap }) {
  const [current, setCurrent] = useState(staffList.map((e) => ({ ...e })))
  const [search, setSearch] = useState('')

  const isLate = shift === 'late'

  // Staff not already on this shift
  const eligible = mockStaff.filter(
    (s) =>
      !['manager', 'deputy'].includes(s.role) &&
      !current.find((e) => e.id === s.id)
  )

  const filtered = eligible.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const removeStaff = (id) => {
    setCurrent((prev) => prev.filter((e) => e.id !== id))
  }

  const addStaff = (staff) => {
    setCurrent((prev) => [...prev, { id: staff.id, sleepIn: false }])
    setSearch('')
  }

  const toggleSleepIn = (id) => {
    const sleepCount = current.filter((e) => e.sleepIn).length
    setCurrent((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        // Only allow toggle on if fewer than 2 sleep-ins
        if (!e.sleepIn && sleepCount >= 2) return e
        return { ...e, sleepIn: !e.sleepIn }
      })
    )
  }

  const sleepCount = current.filter((e) => e.sleepIn).length
  const isBelowMin = current.length < 3

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>
              {shift === 'early' ? 'Early Shift' : 'Late Shift'} — {DAYS[day]}
            </div>
            <div style={s.subtitle}>
              {shift === 'early' ? '07:00–14:30' : '14:00–23:00'}
              {isLate && ` · ${sleepCount}/2 sleep-ins`}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        <div style={s.body}>
          {/* Current staff */}
          <div style={s.sectionLabel}>On this shift</div>
          {current.length === 0 ? (
            <div style={s.empty}>No staff assigned</div>
          ) : (
            <div style={s.staffList}>
              {current.map((entry) => {
                const st = staffMap[entry.id]
                if (!st) return null
                return (
                  <div key={entry.id} style={s.staffRow}>
                    <div
                      style={{
                        ...s.avatar,
                        background:
                          st.gender === 'F'
                            ? 'rgba(122,79,168,0.2)'
                            : 'rgba(108,143,255,0.15)',
                        color: st.gender === 'F' ? '#7a4fa8' : '#6c8fff',
                      }}
                    >
                      {st.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div style={s.staffInfo}>
                      <div style={s.staffName}>{st.name}</div>
                      <div style={s.staffMeta}>
                        {st.roleCode}
                        {st.driver && ' · Driver'}
                        {st.gender === 'F' && ' · Female'}
                      </div>
                    </div>

                    {/* Sleep-in toggle (late shift only) */}
                    {isLate && (
                      <button
                        style={{
                          ...s.sleepBtn,
                          background: entry.sleepIn
                            ? 'rgba(196,136,58,0.2)'
                            : 'rgba(255,255,255,0.05)',
                          color: entry.sleepIn ? '#c4883a' : '#5d6180',
                          border: entry.sleepIn
                            ? '1px solid rgba(196,136,58,0.4)'
                            : '1px solid rgba(255,255,255,0.08)',
                          opacity: !entry.sleepIn && sleepCount >= 2 ? 0.4 : 1,
                        }}
                        onClick={() => toggleSleepIn(entry.id)}
                        title={
                          !entry.sleepIn && sleepCount >= 2
                            ? 'Max 2 sleep-ins per night'
                            : entry.sleepIn
                              ? 'Remove sleep-in'
                              : 'Assign sleep-in'
                        }
                      >
                        💤 {entry.sleepIn ? 'Sleep-in' : 'Add sleep-in'}
                      </button>
                    )}

                    <button
                      style={s.removeBtn}
                      onClick={() => removeStaff(entry.id)}
                      title='Remove from shift'
                    >
                      <FontAwesomeIcon icon='xmark' />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Compliance hints */}
          <div style={s.hints}>
            {isBelowMin && (
              <div style={s.hintWarn}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Below minimum —{' '}
                {current.length}/3 staff
              </div>
            )}
            {isLate && sleepCount < 2 && (
              <div style={s.hintWarn}>
                <FontAwesomeIcon icon='triangle-exclamation' /> {sleepCount}/2
                sleep-ins assigned
              </div>
            )}
            {!current.some((e) => staffMap[e.id]?.gender === 'F') && (
              <div style={s.hintSoft}>
                <FontAwesomeIcon icon='triangle-exclamation' /> No female staff
                on this shift
              </div>
            )}
            {!current.some((e) => staffMap[e.id]?.driver) && (
              <div style={s.hintSoft}>
                <FontAwesomeIcon icon='triangle-exclamation' /> No driver on
                this shift
              </div>
            )}
          </div>

          {/* Add staff */}
          <div style={s.sectionLabel}>Add staff</div>
          <input
            style={s.searchInput}
            placeholder='Search staff by name…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div style={s.eligibleList}>
            {filtered.length === 0 ? (
              <div style={s.empty}>
                {search
                  ? 'No staff match your search'
                  : 'All eligible staff already assigned'}
              </div>
            ) : (
              filtered.map((st) => (
                <div
                  key={st.id}
                  style={s.eligibleRow}
                  onClick={() => addStaff(st)}
                >
                  <div
                    style={{
                      ...s.avatar,
                      width: '30px',
                      height: '30px',
                      fontSize: '11px',
                      background:
                        st.gender === 'F'
                          ? 'rgba(122,79,168,0.2)'
                          : 'rgba(108,143,255,0.15)',
                      color: st.gender === 'F' ? '#7a4fa8' : '#6c8fff',
                    }}
                  >
                    {st.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div style={s.staffInfo}>
                    <div style={s.staffName}>{st.name}</div>
                    <div style={s.staffMeta}>
                      {st.roleCode}
                      {st.driver && ' · Driver'}
                      {st.gender === 'F' && ' · Female'}
                    </div>
                  </div>
                  <div style={s.addTag}>
                    <FontAwesomeIcon icon='plus' /> Add
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <div style={s.footerLeft}>
            {current.length} staff
            {isLate && ` · ${sleepCount}/2 sleep-ins`}
          </div>
          <div style={s.footerActions}>
            <button style={s.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              style={s.saveBtn}
              onClick={() => {
                onSave(current)
                onClose()
              }}
            >
              <FontAwesomeIcon icon='check' /> Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modal: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '18px',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '17px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  subtitle: {
    fontSize: '12px',
    color: '#9499b0',
    marginTop: '4px',
    fontFamily: 'DM Mono, monospace',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#5d6180',
    fontWeight: 500,
  },
  staffList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  staffRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
    fontFamily: 'Syne, sans-serif',
  },
  staffInfo: { flex: 1, minWidth: 0 },
  staffName: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  staffMeta: {
    fontSize: '11px',
    color: '#9499b0',
    marginTop: '2px',
    fontFamily: 'DM Mono, monospace',
  },
  sleepBtn: {
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'transparent',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '6px',
    color: '#e85c3d',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hints: { display: 'flex', flexDirection: 'column', gap: '5px' },
  hintWarn: {
    fontSize: '12px',
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '7px',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  hintSoft: {
    fontSize: '12px',
    color: '#c4883a',
    background: 'rgba(196,136,58,0.08)',
    border: '1px solid rgba(196,136,58,0.2)',
    borderRadius: '7px',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  searchInput: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '9px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e8eaf0',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
  },
  eligibleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  eligibleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.1s',
  },
  addTag: {
    fontSize: '11px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.12)',
    padding: '3px 8px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  empty: {
    fontSize: '12.5px',
    color: '#5d6180',
    padding: '12px 0',
    textAlign: 'center',
  },
  footer: {
    padding: '14px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1d1f2b',
  },
  footerLeft: {
    fontSize: '12px',
    color: '#9499b0',
    fontFamily: 'DM Mono, monospace',
  },
  footerActions: { display: 'flex', gap: '8px' },
  cancelBtn: {
    background: 'transparent',
    color: '#9499b0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  saveBtn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
}

export default CellEditModal
