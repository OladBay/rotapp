// src/components/StickyNote.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { mockUsers } from '../data/mockUsers'

const STICKY_ROLES = ['manager', 'deputy', 'operationallead', 'superadmin']
const STORAGE_KEY_PREFIX = 'rotapp_sticky_notes_'
const NUDGE_SESSION_KEY = 'rotapp_sticky_nudge_shown'

const ALL_STAFF = mockUsers.filter((u) => u.email && u.name)

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}
function textBlock(content = '') {
  return { id: makeId(), type: 'text', content, bold: false, italic: false }
}
function taskBlock(content = '') {
  return {
    id: makeId(),
    type: 'task',
    content,
    done: false,
    bold: false,
    italic: false,
  }
}
function dividerBlock() {
  return { id: makeId(), type: 'divider' }
}
function countUnchecked(blocks) {
  return blocks.filter((b) => b.type === 'task' && !b.done).length
}
function isEffectivelyEmpty(blocks) {
  return (
    blocks.length === 1 &&
    blocks[0].type === 'text' &&
    blocks[0].content.trim() === ''
  )
}
function formatEdited(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return isToday
    ? `today, ${time}`
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}
function blocksToPlainText(blocks, stripMentions = false) {
  return blocks
    .map((b) => {
      if (b.type === 'divider') return '---'
      const content = stripMentions
        ? b.content.replace(/@[\w ]+/g, '').trim()
        : b.content
      if (b.type === 'task') return `[${b.done ? 'x' : ' '}] ${content}`
      return content
    })
    .filter(Boolean)
    .join('\n')
}
function getRoleLabel(role) {
  const map = {
    superadmin: 'Admin',
    operationallead: 'OL',
    manager: 'Manager',
    deputy: 'Deputy',
    senior: 'Senior',
    rcw: 'RCW',
    relief: 'Relief',
  }
  return map[role] || role
}

export default function StickyNote() {
  const { user } = useAuth()
  const role = user?.activeRole || user?.role
  if (!user || !STICKY_ROLES.includes(role)) return null
  return <StickyNoteWidget user={user} />
}

function StickyNoteWidget({ user }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${user.id}`
  const firstName = user.name?.split(' ')[0] || 'there'

  const [saved, setSaved] = useLocalStorage(storageKey, {
    blocks: [textBlock()],
    expandedPosition: null,
    lastEdited: null,
  })

  const [blocks, setBlocks] = useState(() =>
    saved.blocks?.length ? saved.blocks : [textBlock()]
  )
  const [expandedPos, setExpandedPos] = useState(saved.expandedPosition || null)
  const [lastEdited, setLastEdited] = useState(saved.lastEdited || null)
  const [expanded, setExpanded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [focusedId, setFocusedId] = useState(null)
  const blurTimer = useRef(null)

  const [nudgeVisible, setNudgeVisible] = useState(false)
  const [nudgeText, setNudgeText] = useState('')

  const [recording, setRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef(null)
  const transcriptRef = useRef(null)

  const [mentionState, setMentionState] = useState(null)
  const [mentionSearch, setMentionSearch] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const mentionSearchRef = useRef(null)

  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const [panelAnim, setPanelAnim] = useState('in')
  const [pillMounted, setPillMounted] = useState(false)
  const [removingIds, setRemovingIds] = useState(new Set())
  const [badgePop, setBadgePop] = useState(false)
  const prevUnchecked = useRef(countUnchecked(blocks))

  const saveTimer = useRef(null)
  const textareaRefs = useRef({})

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(
    (newBlocks, newPos, newLastEdited) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        setSaved({
          blocks: newBlocks,
          expandedPosition: newPos,
          lastEdited: newLastEdited,
        })
      }, 350)
    },
    [setSaved]
  )

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  const resizeTextarea = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(resizeTextarea)
  }, [blocks, expanded])

  // ── Pill mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setPillMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  // ── Badge pop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const current = countUnchecked(blocks)
    if (current !== prevUnchecked.current) {
      setBadgePop(true)
      setTimeout(() => setBadgePop(false), 400)
      prevUnchecked.current = current
    }
  }, [blocks])

  // ── Auto-scroll transcript ───────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [liveTranscript])

  // ── Focus mention search ─────────────────────────────────────────────────
  useEffect(() => {
    if (mentionState) {
      setMentionSearch('')
      setTimeout(() => mentionSearchRef.current?.focus(), 40)
    }
  }, [mentionState])

  // ── Nudge ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return
    const delay = 90000 + Math.random() * 30000
    const t = setTimeout(() => {
      setNudgeText(
        `Hey ${firstName}, rota planning can get messy. I'm here to help you capture thoughts before they disappear.`
      )
      setNudgeVisible(true)
      sessionStorage.setItem(NUDGE_SESSION_KEY, '1')
      setTimeout(() => setNudgeVisible(false), 6000)
    }, delay)
    return () => clearTimeout(t)
  }, [firstName])

  // ── Block mutations ──────────────────────────────────────────────────────
  const nowTs = () => new Date().toISOString()

  const updateBlocks = useCallback(
    (updater) => {
      setBlocks((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        const ts = nowTs()
        setLastEdited(ts)
        persist(next, expandedPos, ts)
        return next
      })
    },
    [expandedPos, persist]
  )

  const updateBlock = (id, patch) =>
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    )

  const focusBlock = (id, toEnd = true) => {
    setTimeout(() => {
      const el = textareaRefs.current[id]
      if (!el) return
      el.focus()
      if (toEnd) {
        const len = el.value?.length ?? 0
        el.setSelectionRange(len, len)
      }
    }, 30)
  }

  const addBlockAfter = (id, type = 'text') => {
    const newBlock = type === 'task' ? taskBlock() : textBlock()
    updateBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)]
    })
    focusBlock(newBlock.id)
    return newBlock.id
  }

  const addDividerAfter = (id) => {
    const div = dividerBlock()
    const after = textBlock()
    updateBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      return [...prev.slice(0, idx + 1), div, after, ...prev.slice(idx + 1)]
    })
    focusBlock(after.id)
  }

  const removeBlockAnimated = (id) => {
    setRemovingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      updateBlocks((prev) => {
        // FIX 1: reset to fresh plain textBlock instead of keeping task type
        if (prev.length <= 1) return [textBlock()]
        const idx = prev.findIndex((b) => b.id === id)
        const next = prev.filter((b) => b.id !== id)
        const focusIdx = Math.max(0, idx - 1)
        if (next[focusIdx]) focusBlock(next[focusIdx].id)
        return next
      })
    }, 180)
  }

  // ── @ mention ────────────────────────────────────────────────────────────
  const handleTextareaChange = (e, block) => {
    const val = e.target.value
    updateBlock(block.id, { content: val })
    resizeTextarea(e.target)
    const cursor = e.target.selectionStart
    const textUpToCursor = val.slice(0, cursor)
    const atMatch = textUpToCursor.match(/@(\w*)$/)
    if (atMatch) {
      setMentionState({
        blockId: block.id,
        anchorIndex: cursor - atMatch[0].length,
      })
      setMentionSearch(atMatch[1])
    } else {
      setMentionState(null)
    }
  }

  const insertMention = (staffMember) => {
    if (!mentionState) return
    const block = blocks.find((b) => b.id === mentionState.blockId)
    if (!block) return
    const before = block.content.slice(0, mentionState.anchorIndex)
    const after = block.content
      .slice(mentionState.anchorIndex)
      .replace(/@\w*/, '')
    const newContent = `${before}@${staffMember.name}${after}`
    updateBlock(block.id, { content: newContent })
    setSelectedRecipients((prev) =>
      prev.find((r) => r.id === staffMember.id)
        ? prev
        : [
            ...prev,
            {
              id: staffMember.id,
              name: staffMember.name,
              email: staffMember.email,
            },
          ]
    )
    setMentionState(null)
    setTimeout(() => {
      const el = textareaRefs.current[mentionState.blockId]
      if (el) {
        const pos = mentionState.anchorIndex + staffMember.name.length + 1
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    }, 30)
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const handleKeyDown = (e, block) => {
    if (e.key === 'Escape' && mentionState) {
      setMentionState(null)
      return
    }
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey
    if (mod && e.key === 'b') {
      e.preventDefault()
      updateBlock(block.id, { bold: !block.bold })
      return
    }
    if (mod && e.key === 'i') {
      e.preventDefault()
      updateBlock(block.id, { italic: !block.italic })
      return
    }
    if (mod && e.shiftKey && e.key === 'C') {
      e.preventDefault()
      updateBlock(block.id, {
        type: block.type === 'task' ? 'text' : 'task',
        done: false,
      })
      return
    }
    if (mod && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      addDividerAfter(block.id)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setMentionState(null)
      addBlockAfter(block.id, block.type)
      return
    }
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault()
      removeBlockAnimated(block.id)
      return
    }
  }

  const handleClear = () => {
    const fresh = [textBlock()]
    setBlocks(fresh)
    setLastEdited(null)
    setConfirmClear(false)
    setSelectedRecipients([])
    persist(fresh, expandedPos, null)
  }

  // ── Focus management ─────────────────────────────────────────────────────
  const handleFocus = (id) => {
    clearTimeout(blurTimer.current)
    setFocusedId(id)
  }
  const handleBlur = (id) => {
    blurTimer.current = setTimeout(() => {
      setFocusedId((prev) => (prev === id ? null : prev))
    }, 150)
  }
  const getFocusedBlock = () => blocks.find((b) => b.id === focusedId)

  const handleBodyClick = (e) => {
    if (e.target === e.currentTarget) {
      const lastTextBlock = [...blocks]
        .reverse()
        .find((b) => b.type !== 'divider')
      if (lastTextBlock) focusBlock(lastTextBlock.id)
    }
  }

  // ── Expand / collapse ────────────────────────────────────────────────────
  const handleExpand = () => {
    setPanelAnim('in')
    setExpanded(true)
  }
  const handleCollapse = () => {
    setPanelAnim('out')
    if (recording) stopRecording()
    setMentionState(null)
    setTimeout(() => {
      setExpanded(false)
      setConfirmClear(false)
      setVoiceError('')
    }, 220)
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  const defaultPos = () => ({
    x: window.innerWidth - 344,
    y: window.innerHeight - 500,
  })

  const onMouseDown = (e) => {
    if (e.target.closest('input,textarea,button')) return
    dragging.current = true
    const pos = expandedPos || defaultPos()
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const x = Math.max(
        0,
        Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x)
      )
      const y = Math.max(
        0,
        Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)
      )
      setExpandedPos({ x, y })
    }
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false
        setExpandedPos((prev) => {
          if (prev) persist(blocks, prev, lastEdited)
          return prev
        })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [blocks, lastEdited, persist])

  // ── Voice ─────────────────────────────────────────────────────────────────
  const startRecording = () => {
    setVoiceError('')
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setVoiceError('Voice not supported. Use Chrome or Edge.')
      return
    }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onstart = () => setRecording(true)
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      setLiveTranscript(text)
    }
    rec.onerror = (e) => {
      setVoiceError(`Mic error: ${e.error}`)
      setRecording(false)
      setLiveTranscript('')
    }
    rec.onend = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
    if (liveTranscript.trim()) {
      const newBlock = textBlock(liveTranscript.trim())
      updateBlocks((prev) => {
        const filtered = prev.filter(
          (b) => b.content !== '' || prev.length === 1
        )
        return [...filtered, newBlock]
      })
      focusBlock(newBlock.id)
    }
    setLiveTranscript('')
  }

  const toolbarAction = (e, fn) => {
    e.preventDefault()
    fn()
  }

  // FIX 2: stripMentions = true so @names don't appear in email body
  const handleSendEmail = () => {
    const to = selectedRecipients.map((r) => r.email).join(',')
    const subject = encodeURIComponent('Rota notes')
    const body = encodeURIComponent(blocksToPlainText(blocks, true))
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  const removeRecipient = (id) =>
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== id))

  // ── Derived ───────────────────────────────────────────────────────────────
  const unchecked = countUnchecked(blocks)
  const isEmpty = isEffectivelyEmpty(blocks)
  const pos = expandedPos || defaultPos()

  const filteredStaff = ALL_STAFF.filter((u) => {
    if (!mentionSearch) return true
    const q = mentionSearch.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  return (
    <>
      <style>{`
        @keyframes sn-panel-in {
          from { opacity:0; transform:scale(0.94) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes sn-panel-out {
          from { opacity:1; transform:scale(1) translateY(0); }
          to   { opacity:0; transform:scale(0.94) translateY(10px); }
        }
        @keyframes sn-line-in  { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes sn-line-out { from{opacity:1;max-height:48px;} to{opacity:0;max-height:0;padding:0;margin:0;} }
        @keyframes sn-banner-in { from{opacity:0;max-height:0;} to{opacity:1;max-height:120px;} }
        @keyframes sn-pop  { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1)} }
        @keyframes sn-pulse{ 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes sn-picker-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sn-fade-in { from{opacity:0} to{opacity:1} }
        .sn-pill-btn:hover { opacity:0.88; transform:translateY(-2px) !important; }
        .sn-hdr-btn:hover  { background:rgba(255,255,255,0.08) !important; }
        .sn-tbr-btn:hover  { background:var(--bg-hover) !important; }
        .sn-textarea { resize:none; overflow:hidden; }
        .sn-textarea:focus { outline:none; }
        .sn-staff-row:hover { background:var(--bg-hover); }
        .sn-recipient:hover button { opacity:1 !important; }
      `}</style>

      {/* Nudge toast */}
      <div
        style={{
          position: 'fixed',
          bottom: 72,
          right: 24,
          maxWidth: 256,
          background: 'var(--bg-overlay)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          lineHeight: 1.55,
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid var(--border-default)',
          zIndex: 10001,
          boxShadow: 'var(--shadow-md)',
          pointerEvents: 'none',
          fontFamily: 'DM Sans, sans-serif',
          opacity: nudgeVisible ? 1 : 0,
          transform: nudgeVisible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {nudgeText}
      </div>

      {/* Collapsed pill */}
      {!expanded && (
        <button
          className='sn-pill-btn'
          onClick={handleExpand}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--sn-pill-bg)',
            color: 'var(--sn-pill-text)',
            padding: '10px 18px 10px 14px',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: 'var(--shadow-md)',
            border: 'none',
            zIndex: 9998,
            opacity: pillMounted ? 1 : 0,
            transform: pillMounted
              ? 'translateY(0) scale(1)'
              : 'translateY(16px) scale(0.92)',
            transition:
              'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <FontAwesomeIcon
            icon={['fas', 'pen-to-square']}
            style={{ fontSize: 13 }}
          />
          Rota notes
          {unchecked > 0 && (
            <span
              style={{
                background: 'var(--color-success)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                lineHeight: '16px',
                display: 'inline-block',
                animation: badgePop ? 'sn-pop 0.35s ease' : 'none',
              }}
            >
              {unchecked}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: 320,
            zIndex: 9999,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--sn-border)',
            background: 'var(--sn-bg)',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 540,
            overflow: 'hidden',
            animation: `${panelAnim === 'in' ? 'sn-panel-in' : 'sn-panel-out'} 0.22s cubic-bezier(0.34,1.3,0.64,1) forwards`,
          }}
        >
          {/* Header */}
          <div
            onMouseDown={onMouseDown}
            style={{
              background: 'var(--sn-header)',
              padding: '11px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              flexShrink: 0,
              userSelect: 'none',
              borderRadius:
                'calc(var(--radius-xl) - 1px) calc(var(--radius-xl) - 1px) 0 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon
                icon={['fas', 'pen-to-square']}
                style={{ color: 'var(--text-muted)', fontSize: 13 }}
              />
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Rota notes
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FontAwesomeIcon
                icon={['fas', 'grip-vertical']}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  opacity: 0.4,
                }}
              />
              <button
                className='sn-hdr-btn'
                onClick={handleCollapse}
                title='Collapse'
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                }}
              >
                <FontAwesomeIcon icon={['fas', 'chevron-down']} />
              </button>
            </div>
          </div>

          {/* Recording banner — FIX 3: transcript scrolls with ref */}
          {recording && (
            <div
              style={{
                background: 'var(--sn-recording-bg)',
                borderBottom: '1px solid var(--sn-recording-border)',
                padding: '8px 12px',
                flexShrink: 0,
                animation: 'sn-banner-in 0.2s ease forwards',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--color-danger)',
                      display: 'inline-block',
                      animation: 'sn-pulse 1s infinite',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-danger)',
                    }}
                  >
                    Recording
                  </span>
                </div>
                <button
                  onClick={stopRecording}
                  style={{
                    background: 'var(--color-danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <FontAwesomeIcon
                    icon={['fas', 'stop']}
                    style={{ fontSize: 9 }}
                  />
                  Stop & insert
                </button>
              </div>
              <div
                ref={transcriptRef}
                style={{ maxHeight: 64, overflowY: 'auto' }}
              >
                {liveTranscript ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: 'var(--color-danger)',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                      opacity: 0.9,
                    }}
                  >
                    {liveTranscript}
                  </p>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Listening…
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Voice error */}
          {voiceError && !recording && (
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--color-danger-bg)',
                borderBottom: '1px solid var(--color-danger-border)',
                fontSize: 11,
                color: 'var(--color-danger)',
                flexShrink: 0,
              }}
            >
              {voiceError}
            </div>
          )}

          {/* Toolbar */}
          <div
            style={{
              padding: '7px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--sn-border)',
              flexShrink: 0,
              background: 'var(--bg-raised)',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', gap: 3 }}>
              {[
                {
                  label: (
                    <span style={{ fontWeight: 700, fontSize: 12 }}>B</span>
                  ),
                  title: 'Bold (Cmd/Ctrl+B)',
                  active: getFocusedBlock()?.bold,
                  action: () => {
                    const b = getFocusedBlock()
                    if (b) updateBlock(b.id, { bold: !b.bold })
                  },
                },
                {
                  label: (
                    <span style={{ fontStyle: 'italic', fontSize: 12 }}>I</span>
                  ),
                  title: 'Italic (Cmd/Ctrl+I)',
                  active: getFocusedBlock()?.italic,
                  action: () => {
                    const b = getFocusedBlock()
                    if (b) updateBlock(b.id, { italic: !b.italic })
                  },
                },
                {
                  label: (
                    <FontAwesomeIcon
                      icon={['fas', 'list-check']}
                      style={{ fontSize: 10 }}
                    />
                  ),
                  title: 'Checklist (Cmd/Ctrl+Shift+C)',
                  active: getFocusedBlock()?.type === 'task',
                  action: () => {
                    const b = getFocusedBlock()
                    if (b)
                      updateBlock(b.id, {
                        type: b.type === 'task' ? 'text' : 'task',
                        done: false,
                      })
                  },
                },
                {
                  label: <span style={{ fontSize: 14, lineHeight: 1 }}>—</span>,
                  title: 'Divider (Cmd/Ctrl+Shift+D)',
                  active: false,
                  action: () => {
                    const b = getFocusedBlock()
                    if (b) addDividerAfter(b.id)
                  },
                },
              ].map((btn, i) => (
                <button
                  key={i}
                  className='sn-tbr-btn'
                  title={btn.title}
                  onMouseDown={(e) => toolbarAction(e, btn.action)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `1px solid ${btn.active ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                    background: btn.active ? 'var(--accent-bg)' : 'transparent',
                    color: btn.active
                      ? 'var(--accent)'
                      : 'var(--sn-icon-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              className='sn-tbr-btn'
              title={recording ? 'Stop recording' : 'Record voice note'}
              onMouseDown={(e) =>
                toolbarAction(e, recording ? stopRecording : startRecording)
              }
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: `1px solid ${recording ? 'var(--color-danger-border)' : 'var(--border-default)'}`,
                background: recording
                  ? 'var(--color-danger-bg)'
                  : 'transparent',
                color: recording
                  ? 'var(--color-danger)'
                  : 'var(--sn-icon-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.12s',
              }}
            >
              <FontAwesomeIcon
                icon={['fas', recording ? 'stop' : 'microphone']}
                style={{ fontSize: 10 }}
              />
            </button>
          </div>

          {/* Body */}
          <div
            onClick={handleBodyClick}
            style={{
              padding: '10px 12px',
              overflowY: 'auto',
              flex: 1,
              minHeight: 120,
              position: 'relative',
              cursor: 'text',
            }}
          >
            {/* Empty state hint */}
            {isEmpty && !recording && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 14,
                  right: 14,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  animation: 'sn-fade-in 0.3s ease',
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 12,
                    color: 'var(--sn-placeholder)',
                    lineHeight: 1.6,
                  }}
                >
                  Hey {firstName} — jot down shift gaps to fill, staff to chase,
                  ideas for next week's rota. Anything on your mind.
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--sn-placeholder)',
                    opacity: 0.7,
                  }}
                >
                  Tip: type{' '}
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      background: 'var(--bg-active)',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}
                  >
                    @name
                  </span>{' '}
                  to mention and email a colleague
                </p>
              </div>
            )}

            {/* Blocks */}
            {blocks.map((block) => {
              const isRemoving = removingIds.has(block.id)

              if (block.type === 'divider') {
                return (
                  <div
                    key={block.id}
                    style={{
                      margin: '6px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      animation: isRemoving
                        ? 'sn-line-out 0.18s ease forwards'
                        : 'sn-line-in 0.15s ease',
                    }}
                  >
                    <hr
                      style={{
                        flex: 1,
                        border: 'none',
                        borderTop: '1px solid var(--sn-divider)',
                        margin: 0,
                      }}
                    />
                    <button
                      onClick={() => removeBlockAnimated(block.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: 9,
                        padding: '0 2px',
                        opacity: 0.5,
                        lineHeight: 1,
                      }}
                    >
                      <FontAwesomeIcon icon={['fas', 'xmark']} />
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={block.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 7,
                    marginBottom: 3,
                    animation: isRemoving
                      ? 'sn-line-out 0.18s ease forwards'
                      : 'sn-line-in 0.15s ease',
                    overflow: 'hidden',
                  }}
                >
                  {block.type === 'task' && (
                    <input
                      type='checkbox'
                      checked={block.done}
                      onChange={() =>
                        updateBlock(block.id, { done: !block.done })
                      }
                      style={{
                        marginTop: 5,
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        width: 13,
                        height: 13,
                      }}
                    />
                  )}
                  <textarea
                    ref={(el) => {
                      textareaRefs.current[block.id] = el
                    }}
                    className='sn-textarea'
                    rows={1}
                    value={block.content}
                    onChange={(e) => handleTextareaChange(e, block)}
                    onKeyDown={(e) => handleKeyDown(e, block)}
                    onFocus={() => handleFocus(block.id)}
                    onBlur={() => handleBlur(block.id)}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'var(--sn-input-bg)',
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      color: block.done
                        ? 'var(--text-muted)'
                        : 'var(--sn-text)',
                      fontWeight: block.bold ? 700 : 400,
                      fontStyle: block.italic ? 'italic' : 'normal',
                      textDecoration: block.done ? 'line-through' : 'none',
                      lineHeight: 1.6,
                      padding: '2px 0',
                      minWidth: 0,
                      width: '100%',
                      caretColor: 'var(--accent)',
                      transition: 'color 0.15s',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  />
                </div>
              )
            })}

            {/* @ mention picker */}
            {mentionState && (
              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 10,
                  animation: 'sn-picker-in 0.15s ease',
                  overflow: 'hidden',
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    padding: '8px 10px 6px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <input
                    ref={mentionSearchRef}
                    type='text'
                    placeholder='Search by name or role…'
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setMentionState(null)
                      }
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: 'DM Sans, sans-serif',
                      caretColor: 'var(--accent)',
                    }}
                  />
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {filteredStaff.length === 0 ? (
                    <p
                      style={{
                        padding: '10px 12px',
                        margin: 0,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      No staff found
                    </p>
                  ) : (
                    filteredStaff.map((u) => {
                      const isSelected = selectedRecipients.some(
                        (r) => r.id === u.id
                      )
                      return (
                        <div
                          key={u.id}
                          className='sn-staff-row'
                          onClick={() => insertMention(u)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '7px 12px',
                            cursor: 'pointer',
                            background: isSelected
                              ? 'var(--accent-bg)'
                              : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              flexShrink: 0,
                              background: isSelected
                                ? 'var(--accent)'
                                : 'var(--bg-overlay)',
                              color: isSelected
                                ? '#fff'
                                : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {u.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {u.name}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 10,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {getRoleLabel(u.role)}
                            </p>
                          </div>
                          {isSelected && (
                            <FontAwesomeIcon
                              icon={['fas', 'check']}
                              style={{ fontSize: 10, color: 'var(--accent)' }}
                            />
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                <div
                  style={{
                    padding: '6px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Click to mention · selected recipients will be emailed
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recipients row */}
          {selectedRecipients.length > 0 && (
            <div
              style={{
                padding: '6px 12px',
                borderTop: '1px solid var(--sn-border)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                flexShrink: 0,
                background: 'var(--bg-raised)',
                animation: 'sn-line-in 0.15s ease',
              }}
            >
              {selectedRecipients.map((r) => (
                <span
                  key={r.id}
                  className='sn-recipient'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--accent-border)',
                  }}
                >
                  {r.name}
                  <button
                    onClick={() => removeRecipient(r.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--accent)',
                      fontSize: 9,
                      padding: 0,
                      opacity: 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      lineHeight: 1,
                    }}
                  >
                    <FontAwesomeIcon icon={['fas', 'xmark']} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              padding: '7px 12px',
              borderTop: '1px solid var(--sn-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              background: 'var(--sn-footer)',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              {lastEdited ? (
                `Edited ${formatEdited(lastEdited)}`
              ) : (
                <span>
                  Type{' '}
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 10,
                      background: 'var(--bg-active)',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}
                  >
                    @
                  </span>{' '}
                  to mention
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {selectedRecipients.length > 0 && (
                <button
                  onClick={handleSendEmail}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'DM Sans, sans-serif',
                    animation: 'sn-line-in 0.15s ease',
                  }}
                >
                  <FontAwesomeIcon
                    icon={['fas', 'pen-to-square']}
                    style={{ fontSize: 9 }}
                  />
                  Send email
                </button>
              )}
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  style={{
                    fontSize: 11,
                    color: 'var(--color-danger)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'DM Sans, sans-serif',
                    opacity: 0.7,
                  }}
                >
                  Clear
                </button>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    animation: 'sn-line-in 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>
                    Sure?
                  </span>
                  <button
                    onClick={handleClear}
                    style={{
                      background: 'var(--color-danger)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    style={{
                      background: 'var(--bg-active)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
