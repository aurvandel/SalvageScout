import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchSearchStatus, triggerSearch as triggerSearchRequest } from '../api/client'
import type { SearchStatusOut, TriggerSearchResponse } from '../api/types'

const POLL_INTERVAL_MS = 3000

export interface Toast {
  id: number
  kind: 'success' | 'error'
  text: string
}

interface SearchStatusContextValue {
  status: SearchStatusOut | null
  toasts: Toast[]
  dismissToast: (id: number) => void
  triggerSearch: () => Promise<TriggerSearchResponse>
}

const SearchStatusContext = createContext<SearchStatusContextValue | null>(null)

function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

function pushBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Some browsers can still throw (e.g. no service worker in certain contexts) — toast already covers this.
  }
}

export function SearchStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SearchStatusOut | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenRef = useRef<{ runId: number; status: string } | null>(null)
  // Set by this tab's own triggerSearch() to the last-known run_id, so a run that
  // completes faster than one poll interval (e.g. it fails immediately with no
  // active criteria profile) still gets a notification even though this tab never
  // observes an intermediate "running" poll to detect the transition from.
  const awaitingRunAfterRef = useRef<number | null>(null)
  const lastToastedRunIdRef = useRef<number | null>(null)
  const nextToastId = useRef(1)

  const addToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextToastId.current++
    setToasts(prev => [...prev, { id, kind, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const next = await fetchSearchStatus()
        if (cancelled) return
        setStatus(next)

        const previous = seenRef.current
        const isTerminal = next.status === 'completed' || next.status === 'error'
        const observedLiveTransition =
          previous !== null && previous.runId === next.run_id && previous.status === 'running' && isTerminal
        const finishedBeforeFirstObservedRunning =
          awaitingRunAfterRef.current !== null && next.run_id > awaitingRunAfterRef.current && isTerminal
        const alreadyToasted = lastToastedRunIdRef.current === next.run_id

        if ((observedLiveTransition || finishedBeforeFirstObservedRunning) && !alreadyToasted) {
          if (next.status === 'completed') {
            const text = next.error_message
              ? `Search complete with errors: ${next.total_listings} item(s) found, ${next.new_listings} new. ${next.error_message}`
              : `Search complete: ${next.total_listings} item(s) found, ${next.new_listings} new.`
            addToast(next.error_message ? 'error' : 'success', text)
            pushBrowserNotification('Search complete', text)
          } else {
            const text = `Search failed: ${next.error_message ?? 'Unknown error'}`
            addToast('error', text)
            pushBrowserNotification('Search failed', text)
          }
          lastToastedRunIdRef.current = next.run_id
          awaitingRunAfterRef.current = null
        }
        seenRef.current = { runId: next.run_id, status: next.status }
      } catch {
        // Transient network/poll failure — try again next interval, don't spam a toast.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [addToast])

  const triggerSearch = useCallback(async () => {
    requestNotificationPermission()
    const response = await triggerSearchRequest()
    if (response.message.startsWith('Search started')) {
      awaitingRunAfterRef.current = seenRef.current?.runId ?? 0
    }
    return response
  }, [])

  return (
    <SearchStatusContext.Provider value={{ status, toasts, dismissToast, triggerSearch }}>
      {children}
    </SearchStatusContext.Provider>
  )
}

export function useSearchStatus() {
  const ctx = useContext(SearchStatusContext)
  if (!ctx) throw new Error('useSearchStatus must be used within a SearchStatusProvider')
  return ctx
}
