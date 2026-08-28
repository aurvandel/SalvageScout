import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import StatusTab from "./StatusTab"

vi.mock("../../api/client", () => ({
  fetchSystemStatus: vi.fn(),
  fetchLogs: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSystemStatus, fetchLogs } = clientModule

const emptyStatus = { llm: [], scrapers: [] }
const emptyLogs = { logs: [], last_id: 0 }

describe("StatusTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchLogs).mockResolvedValue(emptyLogs)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchSystemStatus).mockImplementation(() => new Promise(() => {}))
    render(<StatusTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("shows connected LLM providers", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [{ provider: "anthropic", configured: true, status: "connected", error: null }],
      scrapers: [],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("Anthropic")).toBeInTheDocument()
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })
  })

  it("shows an error message for a failed LLM connection", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [{ provider: "openai", configured: true, status: "error", error: "invalid api key" }],
      scrapers: [],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeInTheDocument()
      expect(screen.getByText("Error")).toBeInTheDocument()
      expect(screen.getByText("invalid api key")).toBeInTheDocument()
    })
  })

  it("shows not configured for a provider with no key set", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [{ provider: "gemini", configured: false, status: "not_configured", error: null }],
      scrapers: [],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("Not Configured")).toBeInTheDocument()
    })
  })

  it("renders scraper statuses", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [],
      scrapers: [{ provider: "apify", configured: true, status: "connected", error: null, label: null }],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("Apify")).toBeInTheDocument()
    })
  })

  it("renders one row per Apify account with its label", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [],
      scrapers: [
        { provider: "apify", configured: true, status: "connected", error: null, label: "Mine" },
        { provider: "apify", configured: true, status: "error", error: "boom", label: "Wife's" },
      ],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText(/Apify — Mine/)).toBeInTheDocument()
      expect(screen.getByText(/Apify — Wife's/)).toBeInTheDocument()
    })
  })

  it("displays an error message when fetching status fails", async () => {
    vi.mocked(fetchSystemStatus).mockRejectedValue(new Error("Network error"))
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })

  it("re-fetches status when the refresh button is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)
    render(<StatusTab />)
    await waitFor(() => expect(fetchSystemStatus).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Refresh" }))

    await waitFor(() => expect(fetchSystemStatus).toHaveBeenCalledTimes(2))
  })

  it("shows a placeholder when there is no log activity", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("No log activity yet.")).toBeInTheDocument()
    })
  })

  it("polls for new logs and appends them", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)
    vi.mocked(fetchLogs)
      .mockResolvedValueOnce(emptyLogs)
      .mockResolvedValueOnce({
        logs: [{ id: 1, created_at: "2026-08-27T00:00:00Z", level: "INFO", logger_name: "app.pipeline", message: "starting run" }],
        last_id: 1,
      })

    render(<StatusTab />)
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(1))
    expect(fetchLogs).toHaveBeenCalledWith(0)

    await vi.advanceTimersByTimeAsync(2000)
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(2))
    expect(fetchLogs).toHaveBeenLastCalledWith(0)

    await waitFor(() => {
      expect(screen.getByText("starting run")).toBeInTheDocument()
    })
  })

  it("advances since_id from the server-reported last_id on the next poll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)
    vi.mocked(fetchLogs).mockResolvedValueOnce({
      logs: [{ id: 5, created_at: "2026-08-27T00:00:00Z", level: "INFO", logger_name: "app.pipeline", message: "entry 5" }],
      last_id: 5,
    })

    render(<StatusTab />)
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(1))

    vi.mocked(fetchLogs).mockResolvedValueOnce(emptyLogs)
    await vi.advanceTimersByTimeAsync(2000)
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(2))
    expect(fetchLogs).toHaveBeenLastCalledWith(5)
  })

  it("stops polling when paused and resumes when clicked again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)

    render(<StatusTab />)
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Pause" }))
    vi.mocked(fetchLogs).mockClear()

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchLogs).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Resume" }))
    await waitFor(() => expect(fetchLogs).toHaveBeenCalledTimes(1))
  })

  it("clears displayed logs when Clear is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(fetchSystemStatus).mockResolvedValue(emptyStatus)
    vi.mocked(fetchLogs).mockResolvedValueOnce({
      logs: [{ id: 1, created_at: "2026-08-27T00:00:00Z", level: "INFO", logger_name: "app.pipeline", message: "some log line" }],
      last_id: 1,
    })

    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("some log line")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Clear" }))

    expect(screen.queryByText("some log line")).not.toBeInTheDocument()
    expect(screen.getByText("No log activity yet.")).toBeInTheDocument()
  })

  it("shows distinct badge styling per LLM row and scraper row", async () => {
    vi.mocked(fetchSystemStatus).mockResolvedValue({
      llm: [{ provider: "anthropic", configured: true, status: "connected", error: null }],
      scrapers: [{ provider: "bright_data", configured: true, status: "error", error: "boom", label: null }],
    })
    render(<StatusTab />)
    await waitFor(() => {
      expect(screen.getByText("Bright Data")).toBeInTheDocument()
    })
    const scraperRow = screen.getByText("Bright Data").closest(".filter-row") as HTMLElement
    expect(within(scraperRow).getByText("Error")).toBeInTheDocument()
  })
})
