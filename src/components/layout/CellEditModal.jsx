import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './CellEditModal.module.css'

function CellEditModal({
  day,
  shift,
  staffList,
  onClose,
  onSave,
  staffMap,
  staff = [],
}) {
  const [current, setCurrent] = useState(staffList.map((e) => ({ ...e })))
  const [search, setSearch] = useState('')

  const isLate = shift === 'late'

  const eligible = staff.filter(
    (s) =>
      !['manager', 'deputy', 'superadmin', 'operationallead'].includes(
        s.role
      ) &&
      s.status === 'active' &&
      !current.find((e) => e.id === s.id)
  )

  const filtered = eligible.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const removeStaff = (id) => {
    setCurrent((prev) => prev.filter((e) => e.id !== id))
  }

  const addStaff = (member) => {
    setCurrent((prev) => [...prev, { id: member.id, sleepIn: false }])
    setSearch('')
  }

  const toggleSleepIn = (id) => {
    const sleepCount = current.filter((e) => e.sleepIn).length
    setCurrent((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        if (!e.sleepIn && sleepCount >= 2) return e
        return { ...e, sleepIn: !e.sleepIn }
      })
    )
  }

  const sleepCount = current.filter((e) => e.sleepIn).length
  const isBelowMin = current.length < 3

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              {shift === 'early' ? 'Early Shift' : 'Late Shift'} — {DAYS[day]}
            </div>
            <div className={styles.subtitle}>
              {shift === 'early' ? '07:00–14:30' : '14:00–23:00'}
              {isLate && ` · ${sleepCount}/2 sleep-ins`}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        <div className={styles.body}>
          {/* Current staff */}
          <div className={styles.sectionLabel}>On this shift</div>
          {current.length === 0 ? (
            <div className={styles.empty}>No staff assigned</div>
          ) : (
            <div className={styles.staffList}>
              {current.map((entry) => {
                const st = staffMap[entry.id]
                if (!st) return null
                return (
                  <div key={entry.id} className={styles.staffRow}>
                    <div
                      className={styles.avatar}
                      style={{
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
                    <div className={styles.staffInfo}>
                      <div className={styles.staffName}>{st.name}</div>
                      <div className={styles.staffMeta}>
                        {st.roleCode}
                        {st.driver && ' · Driver'}
                        {st.gender === 'F' && ' · Female'}
                      </div>
                    </div>

                    {/* Sleep-in toggle — late shift only */}
                    {isLate && (
                      <button
                        className={styles.sleepBtn}
                        style={{
                          background: entry.sleepIn
                            ? 'rgba(196,136,58,0.2)'
                            : 'var(--bg-active)',
                          color: entry.sleepIn
                            ? 'var(--color-warning)'
                            : 'var(--text-muted)',
                          border: entry.sleepIn
                            ? '1px solid rgba(196,136,58,0.4)'
                            : '1px solid var(--border-subtle)',
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
                        <FontAwesomeIcon icon='moon' />
                        {entry.sleepIn ? 'Sleep-in' : 'Add sleep-in'}
                      </button>
                    )}

                    <button
                      className={styles.removeBtn}
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
          <div className={styles.hints}>
            {isBelowMin && (
              <div className={styles.hintWarn}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Below minimum —{' '}
                {current.length}/3 staff
              </div>
            )}
            {isLate && sleepCount < 2 && (
              <div className={styles.hintWarn}>
                <FontAwesomeIcon icon='triangle-exclamation' /> {sleepCount}/2
                sleep-ins assigned
              </div>
            )}
            {!current.some((e) => staffMap[e.id]?.gender === 'F') && (
              <div className={styles.hintSoft}>
                <FontAwesomeIcon icon='triangle-exclamation' /> No female staff
                on this shift
              </div>
            )}
            {!current.some((e) => staffMap[e.id]?.driver) && (
              <div className={styles.hintSoft}>
                <FontAwesomeIcon icon='triangle-exclamation' /> No driver on
                this shift
              </div>
            )}
          </div>

          {/* Add staff */}
          <div className={styles.sectionLabel}>Add staff</div>
          <input
            className={styles.searchInput}
            placeholder='Search staff by name…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.eligibleList}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                {search
                  ? 'No staff match your search'
                  : 'All eligible staff already assigned'}
              </div>
            ) : (
              filtered.map((st) => (
                <div
                  key={st.id}
                  className={styles.eligibleRow}
                  onClick={() => addStaff(st)}
                >
                  <div
                    className={styles.avatarSm}
                    style={{
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
                  <div className={styles.staffInfo}>
                    <div className={styles.staffName}>{st.name}</div>
                    <div className={styles.staffMeta}>
                      {st.roleCode}
                      {st.driver && ' · Driver'}
                      {st.gender === 'F' && ' · Female'}
                    </div>
                  </div>
                  <div className={styles.addTag}>
                    <FontAwesomeIcon icon='plus' /> Add
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {current.length} staff
            {isLate && ` · ${sleepCount}/2 sleep-ins`}
          </div>
          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              className={styles.saveBtn}
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

export default CellEditModal
