import { useSearchStatus } from '../context/SearchStatusContext'

export default function ToastHost() {
  const { toasts, dismissToast } = useSearchStatus()

  if (toasts.length === 0) return null

  return (
    <div className="toast-host">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          onClick={() => dismissToast(toast.id)}
          role="alert"
        >
          {toast.text}
        </div>
      ))}
    </div>
  )
}
