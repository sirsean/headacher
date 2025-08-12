import { createContext } from 'react'

export interface Notification {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

export interface NotificationContextValue {
  notifications: Notification[]
  addNotification: (message: string, type?: Notification['type'], duration?: number) => void
  removeNotification: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)
