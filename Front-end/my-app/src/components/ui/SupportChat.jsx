'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { io } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function SupportChat() {
  const { user } = useAuth()
  const { theme } = useTheme()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [connected, setConnected] = useState(false)

  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const joinedRef = useRef(false)

  const active = !!(user && !user.isAdmin)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  // Socket setup — only connect for eligible users
  useEffect(() => {
    if (!active) return

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      if (!joinedRef.current) {
        socket.emit('join_chat', user._id)
        joinedRef.current = true
      }
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('receive_support_message', (data) => {
      if (data.receiverId !== user._id) return
      setMessages((prev) => [...prev, { ...data, fromMe: false }])
      setUnread((prev) => (open ? 0 : prev + 1))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      joinedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, user?._id])

  const handleOpen = () => {
    setOpen(true)
    setUnread(0)
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !socketRef.current) return

    const payload = {
      receiverId: 'support',
      senderId: user._id,
      senderName: user.name,
      message: text,
    }

    socketRef.current.emit('send_support_message', payload)
    setMessages((prev) => [
      ...prev,
      { ...payload, timestamp: new Date().toISOString(), fromMe: true },
    ])
    setInput('')
  }, [input, user?._id, user?.name])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // All hooks above — safe to return null now
  if (!active) return null

  const isDark = theme === 'dark'

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      {/* Chat panel */}
      {open && (
        <div
          className={`
            flex flex-col w-80 h-[420px] rounded-2xl shadow-2xl border overflow-hidden
            ${isDark
              ? 'bg-slate-800 border-emerald-900/50 text-white'
              : 'bg-white border-emerald-200 text-slate-900'}
          `}
          style={{ boxShadow: isDark ? '0 8px 32px rgba(16, 185, 129, 0.15)' : '0 8px 32px rgba(16, 185, 129, 0.12)' }}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0
              ${isDark ? 'border-emerald-900/40 bg-emerald-950/60' : 'border-emerald-100 bg-emerald-50'}`}
          >
            <div className="flex items-center gap-2.5">
              {/* Headset icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <span className={`text-sm font-bold block leading-tight ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Live Support</span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  <span className={`text-[10px] font-medium ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>
                    {connected ? 'Chat with Admin' : 'Connecting…'}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className={`p-1.5 rounded-lg transition-colors
                ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-emerald-100 text-slate-500'}`}
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                <svg className={`w-10 h-10 ${isDark ? 'text-emerald-500/40' : 'text-emerald-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className={`text-xs text-center font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Need help? Send us a message —<br />our support team is here for you!
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug break-words
                    ${msg.fromMe
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : isDark
                        ? 'bg-slate-700 text-slate-100 rounded-bl-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'}
                  `}
                >
                  {!msg.fromMe && (
                    <p className={`text-[10px] font-semibold mb-0.5 ${isDark ? 'text-emerald-400/80' : 'text-emerald-600/80'}`}>
                      {msg.senderName || 'Admin'}
                    </p>
                  )}
                  <p>{msg.message}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 opacity-60 ${msg.fromMe ? 'text-right' : ''}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className={`flex items-center gap-2 px-3 py-3 border-t flex-shrink-0
              ${isDark ? 'border-emerald-900/40' : 'border-emerald-100'}`}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className={`flex-1 text-sm px-3 py-2 rounded-xl outline-none transition-colors
                ${isDark
                  ? 'bg-slate-700 placeholder-slate-500 text-white border border-slate-600 focus:border-emerald-500'
                  : 'bg-slate-100 placeholder-slate-400 text-slate-900 border border-transparent focus:border-emerald-400'}
              `}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Send message"
              className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button — bottom-LEFT, green/emerald, with label */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        className={`
          relative flex items-center gap-2.5 h-14 rounded-full shadow-lg
          transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
          ${open
            ? 'bg-slate-700 hover:bg-slate-600 text-white px-4'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white pl-4 pr-5'}
        `}
        style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)' }}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            {/* Headset / Support icon */}
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs font-extrabold uppercase tracking-wider whitespace-nowrap">Live Support</span>
          </>
        )}

        {/* Unread badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}

        {/* Online dot indicator */}
        {!open && unread === 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  )
}

