import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface NotificationContextValue {
  notifications: Notification[]
  addNotification: (message: string, type?: Notification['type'], duration?: number) => void
  removeNotification: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within <NotificationProvider>')
  return ctx
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info', duration = 3000) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    const notification: Notification = { id, message, type, duration }
    
    setNotifications(prev => [...prev, notification])

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
  }, [removeNotification])

  // Convenience methods
  const success = useCallback((message: string, duration = 3000) => {
    addNotification(message, 'success', duration)
  }, [addNotification])

  const error = useCallback((message: string, duration = 5000) => {
    addNotification(message, 'error', duration)
  }, [addNotification])

  const info = useCallback((message: string, duration = 3000) => {
    addNotification(message, 'info', duration)
  }, [addNotification])

  const warning = useCallback((message: string, duration = 4000) => {
    addNotification(message, 'warning', duration)
  }, [addNotification])

  const value = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    info,
    warning
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
