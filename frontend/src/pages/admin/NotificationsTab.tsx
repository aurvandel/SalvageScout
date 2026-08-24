import { useEffect, useState } from 'react'
import { fetchSettings, updateNotificationSettings } from '../../api/client'
import type { NotificationSettingsOut } from '../../api/types'

export default function NotificationsTab() {
  const [notif, setNotif] = useState<NotificationSettingsOut | null>(null)
  const [discordEnabled, setDiscordEnabled] = useState(true)
  const [telegramEnabled, setTelegramEnabled] = useState(true)
  const [discordWebhook, setDiscordWebhook] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [threshold, setThreshold] = useState(70)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await fetchSettings()
      setNotif(data.notifications)
      setDiscordEnabled(data.notifications.discord_enabled)
      setTelegramEnabled(data.notifications.telegram_enabled)
      setTelegramChatId(data.notifications.telegram_chat_id || '')
      setThreshold(data.notifications.notification_score_threshold)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification settings')
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError(null)
      const fields: Record<string, string | boolean | number> = {
        discord_enabled: discordEnabled,
        telegram_enabled: telegramEnabled,
        telegram_chat_id: telegramChatId,
        notification_score_threshold: threshold,
      }
      if (discordWebhook) fields.discord_webhook_url = discordWebhook
      if (telegramToken) fields.telegram_bot_token = telegramToken

      const updated = await updateNotificationSettings(fields)
      setNotif(updated.notifications)
      setDiscordWebhook('')
      setTelegramToken('')
      alert('Notification settings updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!notif) {
    return <div className="admin-section"><p>Loading...</p></div>
  }

  return (
    <div className="admin-section">
      <h2>Notifications</h2>
      {error && <div className="error-message">{error}</div>}

      <div className="settings-form">
        <div className="config-item">
          <label>
            <input type="checkbox" checked={discordEnabled} onChange={(e) => setDiscordEnabled(e.target.checked)} />
            Enable Discord
          </label>
        </div>
        <div className="config-item">
          <label htmlFor="discord-webhook">
            Discord Webhook URL {notif.discord_webhook_url_masked && <span className="masked-value">({notif.discord_webhook_url_masked})</span>}
          </label>
          <input
            id="discord-webhook"
            type="password"
            placeholder={notif.discord_webhook_url_masked ? 'Unchanged' : 'Not set'}
            value={discordWebhook}
            onChange={(e) => setDiscordWebhook(e.target.value)}
          />
        </div>

        <div className="config-item">
          <label>
            <input type="checkbox" checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} />
            Enable Telegram
          </label>
        </div>
        <div className="config-item">
          <label htmlFor="telegram-token">
            Telegram Bot Token {notif.telegram_bot_token_masked && <span className="masked-value">({notif.telegram_bot_token_masked})</span>}
          </label>
          <input
            id="telegram-token"
            type="password"
            placeholder={notif.telegram_bot_token_masked ? 'Unchanged' : 'Not set'}
            value={telegramToken}
            onChange={(e) => setTelegramToken(e.target.value)}
          />
        </div>
        <div className="config-item">
          <label htmlFor="telegram-chat-id">Telegram Chat ID</label>
          <input
            id="telegram-chat-id"
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
          />
        </div>

        <div className="config-item">
          <label htmlFor="threshold">Notification Score Threshold</label>
          <input
            id="threshold"
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
          />
          <p className="help-text">Listings scoring at or above this match score trigger a notification.</p>
        </div>

        <button className="save-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Notification Settings'}
        </button>
      </div>
    </div>
  )
}
