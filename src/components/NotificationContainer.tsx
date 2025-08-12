import { useNotifications } from '../context/NotificationContext'

function NotificationItem({ notification, onDismiss }: { 
  notification: { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }
  onDismiss: (id: string) => void 
}) {
  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-[color:color-mix(in_oklch,var(--color-neon-lime)_25%,var(--color-panel))] border-[var(--color-neon-lime)] text-[var(--color-neon-lime)]'
      case 'error':
        return 'bg-[color:color-mix(in_oklch,var(--color-alert)_25%,var(--color-panel))] border-[var(--color-alert)] text-[var(--color-alert)]'
      case 'warning':
        return 'bg-[color:color-mix(in_oklch,var(--color-attention)_25%,var(--color-panel))] border-[var(--color-attention)] text-[var(--color-attention)]'
      case 'info':
      default:
        return 'bg-[color:color-mix(in_oklch,var(--color-neon-cyan)_25%,var(--color-panel))] border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)]'
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return '✓'
      case 'error': return '✕'
      case 'warning': return '⚠'
      case 'info': 
      default: return 'i'
    }
  }

  return (
    <div 
      className={`
        relative px-4 py-3 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-slide-in
        ${getNotificationStyles(notification.type)}
      `}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">
            {getIcon(notification.type)}
          </span>
          <span className="text-sm font-medium">
            {notification.message}
          </span>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          className="text-xs opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
          />
        ))}
      </div>
    </>
  )
}
