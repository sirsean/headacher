import { useState, useCallback, type ReactNode } from 'react'
import { NotificationContext, type Notification } from './NotificationContext'

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
