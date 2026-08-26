import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NotificationsTab from "./NotificationsTab"

vi.mock("../../api/client", () => ({
  fetchSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSettings, updateNotificationSettings } = clientModule

describe("NotificationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("alert", vi.fn())
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchSettings).mockImplementation(() => new Promise(() => {}))
    render(<NotificationsTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders loaded notification settings", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: true, discord_webhook_url_masked: "(***webhook)", telegram_enabled: true, telegram_bot_token_masked: "(***token)", telegram_chat_id: "12345", notification_score_threshold: 75 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByLabelText("Enable Discord")).toBeChecked()
  })

  it("displays masked webhook URL correctly", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: true, discord_webhook_url_masked: "(***webhook123)", telegram_enabled: false, telegram_bot_token_masked: null, telegram_chat_id: null, notification_score_threshold: 70 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.getByText(/\(\*\*\*webhook123\)/)).toBeInTheDocument() })
  })

  it("displays masked bot token correctly", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: false, discord_webhook_url_masked: null, telegram_enabled: true, telegram_bot_token_masked: "(***bottoken456)", telegram_chat_id: "67890", notification_score_threshold: 80 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.getByText(/\(\*\*\*bottoken456\)/)).toBeInTheDocument() })
  })

  it("calls updateNotificationSettings with correct payload", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: false, discord_webhook_url_masked: null, telegram_enabled: false, telegram_bot_token_masked: null, telegram_chat_id: null, notification_score_threshold: 70 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    vi.mocked(updateNotificationSettings).mockResolvedValue({
      notifications: { discord_enabled: true, discord_webhook_url_masked: "(***webhook)", telegram_enabled: true, telegram_bot_token_masked: "(***token)", telegram_chat_id: "12345", notification_score_threshold: 80 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    const user = userEvent.setup()
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.click(screen.getByLabelText("Enable Discord"))
    await user.click(screen.getByLabelText("Enable Telegram"))
    await user.type(screen.getByLabelText("Telegram Chat ID"), "12345")
    const thresholdInput = screen.getByLabelText("Notification Score Threshold")
    await user.clear(thresholdInput)
    await user.type(thresholdInput, "80")
    await user.click(screen.getByRole("button", { name: /save notification settings/i }))
    await waitFor(() => { expect(updateNotificationSettings).toHaveBeenCalled() })
  })

  it("displays error message when save fails", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: false, discord_webhook_url_masked: null, telegram_enabled: false, telegram_bot_token_masked: null, telegram_chat_id: null, notification_score_threshold: 70 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    const errorMsg = "Failed to update notification settings"
    vi.mocked(updateNotificationSettings).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.click(screen.getByRole("button", { name: /save notification settings/i }))
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })

  it("clears webhook input after successful save", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      notifications: { discord_enabled: false, discord_webhook_url_masked: null, telegram_enabled: false, telegram_bot_token_masked: null, telegram_chat_id: null, notification_score_threshold: 70 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    vi.mocked(updateNotificationSettings).mockResolvedValue({
      notifications: { discord_enabled: true, discord_webhook_url_masked: "(***webhook)", telegram_enabled: false, telegram_bot_token_masked: null, telegram_chat_id: null, notification_score_threshold: 70 },
      apify: {} as any, llm: {} as any, scraper: {} as any,
    })
    const user = userEvent.setup()
    render(<NotificationsTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const webhookInput = screen.getByLabelText("Discord Webhook URL") as HTMLInputElement
    await user.type(webhookInput, "https://test-webhook")
    await user.click(screen.getByRole("button", { name: /save notification settings/i }))
    await waitFor(() => { expect(webhookInput.value).toBe("") })
  })
})
