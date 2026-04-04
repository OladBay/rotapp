// src/components/StickyNote.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// ─── Config ───────────────────────────────────────────────────────────────────
const STICKY_ROLES = ['manager', 'deputy', 'operationallead', 'superadmin']
const STORAGE_KEY_PREFIX = 'rotapp_sticky_notes_'
const NUDGE_SESSION_KEY = 'rotapp_sticky_nudge_shown'

// ─── Block helpers ─────────────────────────────────────────────────────────────
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
function hasContent(blocks) {
  return blocks.some(
    (b) => b.type !== 'divider' && b.content?.trim().length > 0
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

// ─── Role guard ────────────────────────────────────────────────────────────────
export default function StickyNote() {
  const { user } = useAuth()
  const role = user?.activeRole || user?.role
  if (!user || !STICKY_ROLES.includes(role)) return null
  return <StickyNoteWidget user={user} />
}

// ─── Widget ────────────────────────────────────────────────────────────────────
function StickyNoteWidget({ user }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${user.id}`
  const firstName = user.name?.split(' ')[0] || 'there'

  const [saved, setSaved] = useLocalStorage(storageKey, {
    blocks: [textBlock()],
    expandedPosition: null,
    lastEdited: null,
  })

  // ── State ──────────────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState(() =>
    saved.blocks?.length ? saved.blocks : [textBlock()]
  )
  const [expandedPos, setExpandedPos] = useState(saved.expandedPosition || null)
  const [lastEdited, setLastEdited] = useState(saved.lastEdited || null)
  const [expanded, setExpanded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [focusedId, setFocusedId] = useState(null)

  // Nudge
  const [nudgeVisible, setNudgeVisible] = useState(false)
  const [nudgeText, setNudgeText] = useState('')

  // Voice
  const [recording, setRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef(null)

  // Drag
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Animations
  const [panelAnim, setPanelAnim] = useState('in') // 'in' | 'out'
  const [pillMounted, setPillMounted] = useState(false)
  const [removingIds, setRemovingIds] = useState(new Set())
  const [badgePop, setBadgePop] = useState(false)
  const prevUnchecked = useRef(countUnchecked(blocks))

  const saveTimer = useRef(null)
  const inputRefs = useRef({})

  // ── Persist ────────────────────────────────────────────────────────────────
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

  // ── Pill mount animation ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setPillMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  // ── Badge pop when unchecked count changes ─────────────────────────────────
  useEffect(() => {
    const current = countUnchecked(blocks)
    if (current !== prevUnchecked.current) {
      setBadgePop(true)
      setTimeout(() => setBadgePop(false), 400)
      prevUnchecked.current = current
    }
  }, [blocks])

  // ── Nudge ──────────────────────────────────────────────────────────────────
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

  // ── Block mutations ────────────────────────────────────────────────────────
  const now = () => new Date().toISOString()

  const updateBlocks = useCallback(
    (updater) => {
      setBlocks((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        const ts = now()
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
      const el = inputRefs.current[id]
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
        if (prev.length <= 1) return [{ ...prev[0], content: '' }]
        const idx = prev.findIndex((b) => b.id === id)
        const next = prev.filter((b) => b.id !== id)
        // Focus the block above
        const focusIdx = Math.max(0, idx - 1)
        if (next[focusIdx]) focusBlock(next[focusIdx].id)
        return next
      })
    }, 180)
  }

  const handleKeyDown = (e, block) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey

    // Cmd/Ctrl + B — bold
    if (mod && e.key === 'b') {
      e.preventDefault()
      updateBlock(block.id, { bold: !block.bold })
      return
    }
    // Cmd/Ctrl + I — italic
    if (mod && e.key === 'i') {
      e.preventDefault()
      updateBlock(block.id, { italic: !block.italic })
      return
    }
    // Cmd/Ctrl + Shift + C — toggle checklist
    if (mod && e.shiftKey && e.key === 'C') {
      e.preventDefault()
      updateBlock(block.id, {
        type: block.type === 'task' ? 'text' : 'task',
        done: false,
      })
      return
    }
    // Cmd/Ctrl + Shift + D — insert divider
    if (mod && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      addDividerAfter(block.id)
      return
    }
    // Enter — new line (same type)
    if (e.key === 'Enter') {
      e.preventDefault()
      addBlockAfter(block.id, block.type)
      return
    }
    // Backspace on empty — remove block
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
    persist(fresh, expandedPos, null)
  }

  // ── Expand / collapse ──────────────────────────────────────────────────────
  const handleExpand = () => {
    setPanelAnim('in')
    setExpanded(true)
  }

  const handleCollapse = () => {
    setPanelAnim('out')
    if (recording) stopRecording()
    setTimeout(() => {
      setExpanded(false)
      setConfirmClear(false)
      setVoiceError('')
    }, 220)
  }

  // ── Drag ───────────────────────────────────────────────────────────────────
  const defaultExpandedPos = () => ({
    x: window.innerWidth - 344,
    y: window.innerHeight - 500,
  })

  const onMouseDown = (e) => {
    if (e.target.closest('input,textarea,button')) return
    dragging.current = true
    const pos = expandedPos || defaultExpandedPos()
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

  // ── Voice ──────────────────────────────────────────────────────────────────
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

  // ── Toolbar button handler (onMouseDown to preserve focus) ────────────────
  const toolbarAction = (e, fn) => {
    e.preventDefault() // prevents stealing focus from input
    fn()
  }

  const getFocusedBlock = () => blocks.find((b) => b.id === focusedId)

  // ── Derived ────────────────────────────────────────────────────────────────
  const unchecked = countUnchecked(blocks)
  const isEmpty = !hasContent(blocks)
  const pos = expandedPos || defaultExpandedPos()

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Global keyframes injected once ── */}
      <style>{`
        @keyframes sn-pill-up {
          from { opacity: 0; transform: translateY(16px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sn-panel-in {
          from { opacity: 0; transform: scale(0.94) translateY(10px); transform-origin: bottom right; }
          to   { opacity: 1; transform: scale(1) translateY(0);       transform-origin: bottom right; }
        }
        @keyframes sn-panel-out {
          from { opacity: 1; transform: scale(1) translateY(0);        transform-origin: bottom right; }
          to   { opacity: 0; transform: scale(0.94) translateY(10px);  transform-origin: bottom right; }
        }
        @keyframes sn-line-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sn-line-out {
          from { opacity: 1; max-height: 40px; transform: translateX(0); }
          to   { opacity: 0; max-height: 0;    transform: translateX(-8px); }
        }
        @keyframes sn-banner-in {
          from { opacity: 0; max-height: 0;   padding-top: 0; padding-bottom: 0; }
          to   { opacity: 1; max-height: 80px; }
        }
        @keyframes sn-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes sn-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
        @keyframes sn-nudge-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sn-strike {
          from { text-decoration-color: transparent; }
          to   { text-decoration-color: currentColor; }
        }
        .sn-pill:hover { opacity: 0.88; transform: translateY(-2px) !important; }
        .sn-icon-btn:hover { background: var(--bg-hover) !important; }
        .sn-input:focus { outline: none; }
      `}</style>

      {/* ── Nudge toast ── */}
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
          opacity: nudgeVisible ? 1 : 0,
          transform: nudgeVisible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {nudgeText}
      </div>

      {/* ── Collapsed pill ── */}
      {!expanded && (
        <button
          className='sn-pill'
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

      {/* ── Expanded panel ── */}
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
            maxHeight: 520,
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
              borderRadius:
                'calc(var(--radius-xl) - 1px) calc(var(--radius-xl) - 1px) 0 0',
              userSelect: 'none',
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
                  opacity: 0.5,
                }}
              />
              <button
                className='sn-icon-btn'
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

          {/* Recording banner */}
          {recording && (
            <div
              style={{
                background: 'var(--sn-recording-bg)',
                borderBottom: '1px solid var(--sn-recording-border)',
                padding: '8px 12px',
                flexShrink: 0,
                animation: 'sn-banner-in 0.2s ease forwards',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: liveTranscript ? 5 : 0,
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
              {liveTranscript ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--color-danger)',
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                    opacity: 0.85,
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
            {/* Format buttons */}
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
                  label: <span style={{ fontSize: 13, lineHeight: 1 }}>—</span>,
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
                  className='sn-icon-btn'
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

            {/* Voice button */}
            <button
              className='sn-icon-btn'
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
            style={{
              padding: '10px 12px',
              overflowY: 'auto',
              flex: 1,
              minHeight: 120,
              position: 'relative',
            }}
          >
            {/* Empty state hint */}
            {isEmpty && !recording && (
              <p
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 14,
                  right: 14,
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--sn-placeholder)',
                  lineHeight: 1.6,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  animation: 'sn-fade-in 0.3s ease',
                }}
              >
                Hey {firstName} — jot down shift gaps to fill, staff to chase,
                ideas for next week's rota. Anything on your mind.
              </p>
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
                      title='Remove divider'
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
                        marginTop: 4,
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        width: 13,
                        height: 13,
                      }}
                    />
                  )}
                  <input
                    ref={(el) => {
                      inputRefs.current[block.id] = el
                    }}
                    id={`sn-input-${block.id}`}
                    className='sn-input'
                    type='text'
                    value={block.content}
                    onChange={(e) =>
                      updateBlock(block.id, { content: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, block)}
                    onFocus={() => setFocusedId(block.id)}
                    onBlur={() =>
                      setFocusedId((prev) => (prev === block.id ? null : prev))
                    }
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
                      textDecorationColor: block.done
                        ? 'var(--text-muted)'
                        : 'transparent',
                      lineHeight: 1.6,
                      padding: '2px 0',
                      minWidth: 0,
                      caretColor: 'var(--accent)',
                      transition: 'color 0.15s, font-weight 0.1s',
                    }}
                  />
                </div>
              )
            })}
          </div>

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
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {lastEdited
                ? `Last edited ${formatEdited(lastEdited)}`
                : 'No notes yet'}
            </span>
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
                Clear all
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  animation: 'sn-line-in 0.15s ease',
                }}
              >
                <span style={{ color: 'var(--color-danger)' }}>
                  Clear everything?
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
      )}
    </>
  )
}
