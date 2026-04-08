import { useState, useEffect } from 'react'

import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import Navbar from '../components/layout/Navbar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchBankHolidays, getBankHolidayForDate } from '../utils/bankHolidays'
import { removeTimeOff } from '../utils/timeOffStorage'
import { toLocalDateString } from '../utils/dateUtils'
import { getEventsForDate, getEventColor } from '../data/worldEvents'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function YearCalendar() {
  const { user } = useAuth()
  const { timeOff, refreshTimeOff } = useRota()
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [bankHolidays, setBankHolidays] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDateInfo, setSelectedDateInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  // Build timeOffRecords keyed by date string from flat context array
  const timeOffRecords = timeOff.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = []
    acc[entry.date].push(entry)
    return acc
  }, {})

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const holidays = await fetchBankHolidays()
      setBankHolidays(holidays)
      setLoading(false)
    }
    loadData()
  }, [])

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOffset = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay()
    return firstDay === 0 ? 6 : firstDay - 1
  }

  const handleDayClick = (date, bankHoliday, staffOff, events = []) => {
    setSelectedDate(date)
    setSelectedDateInfo({ bankHoliday, staffOff, events })
  }

  const handleRemoveTimeOff = async (dateStr, timeOffId) => {
    await removeTimeOff(timeOffId)
    refreshTimeOff()
    const remaining = (timeOffRecords[dateStr] || []).filter(
      (e) => e.id !== timeOffId
    )
    if (remaining.length === 0) {
      setSelectedDate(null)
      setSelectedDateInfo(null)
    } else {
      setSelectedDateInfo((prev) => ({ ...prev, staffOff: remaining }))
    }
  }

  const renderMonth = (year, monthIndex) => {
    const monthName = MONTHS[monthIndex]
    const daysInMonth = getDaysInMonth(year, monthIndex)
    const firstDayOffset = getFirstDayOffset(year, monthIndex)
    const today = new Date()
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() === monthIndex

    const days = []
    for (let i = 0; i < firstDayOffset; i++) {
      days.push(<div key={`empty-${i}`} style={s.emptyCell} />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day)
      const dateStr = toLocalDateString(date)
      const bankHoliday = getBankHolidayForDate(date, bankHolidays)
      const staffOff = timeOffRecords[dateStr] || []
      const isToday = isCurrentMonth && day === today.getDate()

      const dateEvents = getEventsForDate(date, bankHolidays)
      const allEvents = [...dateEvents.fixed, ...dateEvents.bank]
      const hasEvents = allEvents.length > 0

      days.push(
        <div
          key={day}
          style={{
            ...s.dayCell,
            background: hasEvents
              ? `${getEventColor(allEvents[0].type)}08`
              : 'transparent',
            border: isToday
              ? '1.5px solid #6c8fff'
              : '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={() => handleDayClick(date, bankHoliday, staffOff, allEvents)}
        >
          <div style={s.dayNumber}>
            <span style={{ color: isToday ? '#6c8fff' : '#e8eaf0' }}>
              {day}
            </span>
            <div style={s.eventDots}>
              {allEvents.slice(0, 3).map((event, idx) => (
                <span
                  key={idx}
                  style={{
                    ...s.eventDot,
                    background: getEventColor(event.type),
                  }}
                  title={event.name}
                />
              ))}
              {allEvents.length > 3 && (
                <span style={s.eventDotMore}>+{allEvents.length - 3}</span>
              )}
            </div>
          </div>
          <div style={s.staffList}>
            {staffOff.slice(0, 2).map((off) => (
              <div key={off.id} style={s.staffNameTag}>
                {(off.staff_name || off.staffName || '').split(' ')[0]}
              </div>
            ))}
            {staffOff.length > 2 && (
              <div style={s.moreTag}>+{staffOff.length - 2} more</div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div key={monthIndex} style={s.monthCard}>
        <div style={s.monthTitle}>{monthName}</div>
        <div style={s.weekdayHeader}>
          {WEEKDAYS.map((day) => (
            <div key={day} style={s.weekdayLabel}>
              {day}
            </div>
          ))}
        </div>
        <div style={s.daysGrid}>{days}</div>
      </div>
    )
  }

  const monthPairs = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
    [10, 11],
  ]

  if (loading) {
    return (
      <div style={s.page}>
        <Navbar />
        <div style={s.loading}>Loading calendar...</div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.body}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Year Calendar</h1>
            <p style={s.subtitle}>
              Bank holidays + world events + staff time off at a glance
            </p>
          </div>
          <div style={s.yearNav}>
            <button
              style={s.navBtn}
              onClick={() => setCurrentYear((y) => y - 1)}
            >
              <FontAwesomeIcon icon='chevron-left' /> {currentYear - 1}
            </button>
            <span style={s.currentYear}>{currentYear}</span>
            <button
              style={s.navBtn}
              onClick={() => setCurrentYear((y) => y + 1)}
            >
              {currentYear + 1} <FontAwesomeIcon icon='chevron-right' />
            </button>
          </div>
        </div>

        <div style={s.legend}>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#e85c3d' }} /> Bank
            holiday
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#3a8ac4' }} /> Cultural
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#7a4fa8' }} /> Religious
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#2ecc8a' }} /> Awareness
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#c4883a' }} /> Seasonal
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: '#6c8fff' }} /> Staff on
            leave
          </span>
          <span style={s.legendItem}>
            <span
              style={{
                ...s.legendDot,
                background: 'transparent',
                border: '1.5px solid #6c8fff',
              }}
            />{' '}
            Today
          </span>
        </div>

        <div style={s.rowMajorLayout}>
          {monthPairs.map(([leftMonth, rightMonth], rowIdx) => (
            <div key={rowIdx} style={s.monthRow}>
              <div style={s.monthColumn}>
                {renderMonth(currentYear, leftMonth)}
              </div>
              <div style={s.monthColumn}>
                {renderMonth(currentYear, rightMonth)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && selectedDateInfo && (
        <div style={s.overlay} onClick={() => setSelectedDate(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>
                {selectedDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <button style={s.closeBtn} onClick={() => setSelectedDate(null)}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            <div style={s.modalBody}>
              {selectedDateInfo.events &&
                selectedDateInfo.events.length > 0 && (
                  <div style={s.eventsSection}>
                    <div style={s.sectionLabel}>📅 Events</div>
                    <div style={s.eventsList}>
                      {selectedDateInfo.events.map((event, idx) => (
                        <div key={idx} style={s.eventCard}>
                          <span
                            style={{
                              ...s.eventColorDot,
                              background: getEventColor(event.type),
                            }}
                          />
                          <div>
                            <div style={s.eventName}>{event.name}</div>
                            {event.notes && (
                              <div style={s.eventNotes}>{event.notes}</div>
                            )}
                            {event.isBankHoliday && (
                              <div style={s.eventType}>Bank Holiday</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedDateInfo.bankHoliday &&
                !selectedDateInfo.events?.some((e) => e.isBankHoliday) && (
                  <div style={s.bankHolidaySection}>
                    <div style={s.sectionLabel}>🏦 Bank Holiday</div>
                    <div style={s.bankHolidayName}>
                      {selectedDateInfo.bankHoliday.name}
                    </div>
                    {selectedDateInfo.bankHoliday.notes && (
                      <div style={s.bankHolidayNotes}>
                        {selectedDateInfo.bankHoliday.notes}
                      </div>
                    )}
                  </div>
                )}

              {selectedDateInfo.staffOff.length > 0 ? (
                <div style={s.staffOffSection}>
                  <div style={s.sectionLabel}>
                    👥 Staff on leave ({selectedDateInfo.staffOff.length})
                  </div>
                  <div style={s.staffOffList}>
                    {selectedDateInfo.staffOff.map((off) => (
                      <div key={off.id} style={s.staffOffCard}>
                        <div>
                          <div style={s.staffOffName}>
                            {off.staff_name || off.staffName}
                          </div>
                          <div style={s.staffOffType}>
                            Type: {off.type.replace('_', ' ')}
                          </div>
                          {off.notes && (
                            <div style={s.staffOffNotes}>{off.notes}</div>
                          )}
                        </div>
                        <button
                          style={s.removeBtn}
                          onClick={() =>
                            handleRemoveTimeOff(
                              toLocalDateString(selectedDate),
                              off.id
                            )
                          }
                          title='Remove time off'
                        >
                          <FontAwesomeIcon icon='xmark' />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !selectedDateInfo.bankHoliday &&
                (!selectedDateInfo.events ||
                  selectedDateInfo.events.length === 0) && (
                  <div style={s.noData}>
                    No events or staff leave on this date
                  </div>
                )
              )}
            </div>

            <div style={s.modalFooter}>
              <button
                style={s.closeModalBtn}
                onClick={() => setSelectedDate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f1117',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
  },
  body: { padding: '24px', maxWidth: '1400px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  yearNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#1d1f2b',
    padding: '6px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  navBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  currentYear: {
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
    minWidth: '60px',
    textAlign: 'center',
  },
  legend: {
    display: 'flex',
    gap: '20px',
    marginBottom: '24px',
    padding: '12px 16px',
    background: '#161820',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.07)',
    flexWrap: 'wrap',
  },
  legendItem: {
    fontSize: '12px',
    color: '#9499b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  rowMajorLayout: { display: 'flex', flexDirection: 'column', gap: '24px' },
  monthRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
  monthColumn: { width: '100%' },
  monthCard: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    padding: '16px',
  },
  monthTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6c8fff',
    marginBottom: '12px',
    textAlign: 'center',
  },
  weekdayHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '8px',
  },
  weekdayLabel: {
    fontSize: '10px',
    color: '#5d6180',
    textAlign: 'center',
    fontWeight: 500,
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  emptyCell: { aspectRatio: '1' },
  dayCell: {
    aspectRatio: '1',
    borderRadius: '6px',
    padding: '4px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background 0.1s',
  },
  dayNumber: {
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  eventDots: { display: 'flex', gap: '2px', alignItems: 'center' },
  eventDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  eventDotMore: { fontSize: '7px', color: '#5d6180', marginLeft: '2px' },
  staffList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  staffNameTag: {
    fontSize: '8px',
    background: 'rgba(108,143,255,0.15)',
    color: '#6c8fff',
    padding: '1px 4px',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  moreTag: { fontSize: '7px', color: '#5d6180', padding: '1px 4px' },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#9499b0',
  },
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
    borderRadius: '16px',
    width: '100%',
    maxWidth: '450px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  modalTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '16px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  bankHolidaySection: {
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '10px',
    padding: '12px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#9499b0',
    marginBottom: '8px',
  },
  bankHolidayName: { fontSize: '14px', fontWeight: 500, color: '#e85c3d' },
  bankHolidayNotes: { fontSize: '11px', color: '#9499b0', marginTop: '4px' },
  eventsSection: {
    background: 'rgba(108,143,255,0.05)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '10px',
    padding: '12px',
  },
  eventsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  eventCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: '#1d1f2b',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  eventColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginTop: '3px',
    flexShrink: 0,
  },
  eventName: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  eventNotes: { fontSize: '10px', color: '#9499b0', marginTop: '2px' },
  eventType: {
    fontSize: '9px',
    color: '#5d6180',
    marginTop: '2px',
    textTransform: 'capitalize',
  },
  staffOffSection: {
    background: 'rgba(108,143,255,0.05)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '10px',
    padding: '12px',
  },
  staffOffList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  staffOffCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1d1f2b',
    borderRadius: '8px',
    padding: '10px',
  },
  staffOffName: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  staffOffType: { fontSize: '10px', color: '#6c8fff', marginTop: '2px' },
  staffOffNotes: { fontSize: '10px', color: '#9499b0', marginTop: '2px' },
  removeBtn: {
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '6px',
    color: '#e85c3d',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noData: {
    textAlign: 'center',
    color: '#5d6180',
    fontSize: '13px',
    padding: '20px',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalBtn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default YearCalendar
