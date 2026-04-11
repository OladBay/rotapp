import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import Navbar from '../components/layout/Navbar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchBankHolidays, getBankHolidayForDate } from '../utils/bankHolidays'
import { removeTimeOff } from '../utils/timeOffStorage'
import { toLocalDateString } from '../utils/dateUtils'
import { getEventsForDate, getEventColor } from '../data/worldEvents'
import styles from './YearCalendar.module.css'

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

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

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
      days.push(<div key={`empty-${i}`} className={styles.emptyCell} />)
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
          className={styles.dayCell}
          style={{
            background: hasEvents
              ? `${getEventColor(allEvents[0].type)}08`
              : 'transparent',
            border: isToday
              ? '1.5px solid var(--accent)'
              : '1px solid var(--border-subtle)',
          }}
          onClick={() => handleDayClick(date, bankHoliday, staffOff, allEvents)}
        >
          <div className={styles.dayNumber}>
            <span
              style={{
                color: isToday ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {day}
            </span>
            <div className={styles.eventDots}>
              {allEvents.slice(0, 3).map((event, idx) => (
                <span
                  key={idx}
                  className={styles.eventDot}
                  style={{ background: getEventColor(event.type) }}
                  title={event.name}
                />
              ))}
              {allEvents.length > 3 && (
                <span className={styles.eventDotMore}>
                  +{allEvents.length - 3}
                </span>
              )}
            </div>
          </div>
          <div className={styles.staffList}>
            {staffOff.slice(0, 2).map((off) => (
              <div key={off.id} className={styles.staffNameTag}>
                {(off.staff_name || off.staffName || '').split(' ')[0]}
              </div>
            ))}
            {staffOff.length > 2 && (
              <div className={styles.moreTag}>+{staffOff.length - 2} more</div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div key={monthIndex} className={styles.monthCard}>
        <div className={styles.monthTitle}>{monthName}</div>
        <div className={styles.weekdayHeader}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.weekdayLabel}>
              {day}
            </div>
          ))}
        </div>
        <div className={styles.daysGrid}>{days}</div>
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
      <div className={styles.page}>
        <Navbar />
        <div className={styles.loading}>Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Year Calendar</h1>
            <p className={styles.subtitle}>
              Bank holidays + world events + staff time off at a glance
            </p>
          </div>
          <div className={styles.yearNav}>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentYear((y) => y - 1)}
            >
              <FontAwesomeIcon icon='chevron-left' /> {currentYear - 1}
            </button>
            <span className={styles.currentYear}>{currentYear}</span>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentYear((y) => y + 1)}
            >
              {currentYear + 1} <FontAwesomeIcon icon='chevron-right' />
            </button>
          </div>
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--color-danger)' }}
            />
            Bank holiday
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--color-info)' }}
            />
            Cultural
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--color-purple)' }}
            />
            Religious
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--color-success)' }}
            />
            Awareness
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--color-warning)' }}
            />
            Seasonal
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'var(--accent)' }}
            />
            Staff on leave
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotToday} />
            Today
          </span>
        </div>

        <div className={styles.rowMajorLayout}>
          {monthPairs.map(([leftMonth, rightMonth], rowIdx) => (
            <div key={rowIdx} className={styles.monthRow}>
              <div className={styles.monthColumn}>
                {renderMonth(currentYear, leftMonth)}
              </div>
              <div className={styles.monthColumn}>
                {renderMonth(currentYear, rightMonth)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && selectedDateInfo && (
        <div className={styles.overlay} onClick={() => setSelectedDate(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {selectedDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedDate(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            <div className={styles.modalBody}>
              {selectedDateInfo.events &&
                selectedDateInfo.events.length > 0 && (
                  <div className={styles.eventsSection}>
                    <div className={styles.sectionLabel}>
                      <FontAwesomeIcon icon='calendar-days' /> Events
                    </div>
                    <div className={styles.eventsList}>
                      {selectedDateInfo.events.map((event, idx) => (
                        <div key={idx} className={styles.eventCard}>
                          <span
                            className={styles.eventColorDot}
                            style={{ background: getEventColor(event.type) }}
                          />
                          <div>
                            <div className={styles.eventName}>{event.name}</div>
                            {event.notes && (
                              <div className={styles.eventNotes}>
                                {event.notes}
                              </div>
                            )}
                            {event.isBankHoliday && (
                              <div className={styles.eventType}>
                                Bank Holiday
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedDateInfo.bankHoliday &&
                !selectedDateInfo.events?.some((e) => e.isBankHoliday) && (
                  <div className={styles.bankHolidaySection}>
                    <div className={styles.sectionLabel}>
                      <FontAwesomeIcon icon='house' /> Bank Holiday
                    </div>
                    <div className={styles.bankHolidayName}>
                      {selectedDateInfo.bankHoliday.name}
                    </div>
                    {selectedDateInfo.bankHoliday.notes && (
                      <div className={styles.bankHolidayNotes}>
                        {selectedDateInfo.bankHoliday.notes}
                      </div>
                    )}
                  </div>
                )}

              {selectedDateInfo.staffOff.length > 0 ? (
                <div className={styles.staffOffSection}>
                  <div className={styles.sectionLabel}>
                    <FontAwesomeIcon icon='user-group' /> Staff on leave (
                    {selectedDateInfo.staffOff.length})
                  </div>
                  <div className={styles.staffOffList}>
                    {selectedDateInfo.staffOff.map((off) => (
                      <div key={off.id} className={styles.staffOffCard}>
                        <div>
                          <div className={styles.staffOffName}>
                            {off.staff_name || off.staffName}
                          </div>
                          <div className={styles.staffOffType}>
                            Type: {off.type.replace('_', ' ')}
                          </div>
                          {off.notes && (
                            <div className={styles.staffOffNotes}>
                              {off.notes}
                            </div>
                          )}
                        </div>
                        <button
                          className={styles.removeBtn}
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
                  <div className={styles.noData}>
                    No events or staff leave on this date
                  </div>
                )
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.closeModalBtn}
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

export default YearCalendar
