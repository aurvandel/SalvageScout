import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import UsageTab from "./UsageTab"

vi.mock("../../api/client", () => ({
  fetchUsage: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchUsage } = clientModule

const emptyLLMRows: any[] = []

const scrapeCreatorsNotConfigured = { configured: false, credits_remaining: null, credits_used_today: null, requests_today: null, error: null }
const brightDataNotConfigured = { configured: false, balance_usd: null, pending_balance_usd: null, error: null }

describe("UsageTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchUsage).mockImplementation(() => new Promise(() => {}))
    render(<UsageTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("prompts to configure Apify when no accounts are set", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/no apify accounts configured/i)).toBeInTheDocument()
    })
  })

  it("shows used vs limit for each Apify account", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [
        {
          account_id: 1,
          label: "Mine",
          used_usd: 12.5,
          limit_usd: 300,
          cycle_start: "2026-08-01T00:00:00Z",
          cycle_end: "2026-08-31T23:59:59Z",
          error: null,
        },
      ],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("Mine")).toBeInTheDocument()
      expect(screen.getByText("$12.50 used")).toBeInTheDocument()
      expect(screen.getByText("$300.00 monthly limit")).toBeInTheDocument()
    })
  })

  it("surfaces an Apify account's API error without crashing", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [
        { account_id: 1, label: "Mine", used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: "boom" },
      ],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/couldn't reach apify: boom/i)).toBeInTheDocument()
    })
  })

  it("renders per-model LLM spend rows", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: [
        {
          provider: "anthropic",
          model: "claude-haiku-4-5",
          scored_count: 10,
          priced_count: 10,
          input_tokens: 5000,
          output_tokens: 1200,
          estimated_cost_usd: 0.011,
        },
      ],
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument()
      expect(screen.getByText("10 scored")).toBeInTheDocument()
      expect(screen.getByText("$0.01")).toBeInTheDocument()
    })
  })

  it("flags rows with scores older than token tracking", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: [
        {
          provider: "anthropic",
          model: "claude-haiku-4-5",
          scored_count: 5,
          priced_count: 3,
          input_tokens: 3000,
          output_tokens: 900,
          estimated_cost_usd: 0.0075,
        },
      ],
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/priced 3 of 5/i)).toBeInTheDocument()
    })
  })

  it("shows a message when there is no scoring activity", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getAllByText("No scoring activity yet.")).toHaveLength(2)
    })
  })

  it("displays error message when fetching usage fails", async () => {
    vi.mocked(fetchUsage).mockRejectedValue(new Error("Network error"))
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })

  it("prompts to configure ScrapeCreators when no key is set", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/no scrapecreators api key configured/i)).toBeInTheDocument()
    })
  })

  it("shows remaining credits and today's usage when ScrapeCreators is configured", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: { configured: true, credits_remaining: 97, credits_used_today: 3, requests_today: 3, error: null },
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("97 credits remaining")).toBeInTheDocument()
      expect(screen.getByText("3 credits used today (3 requests)")).toBeInTheDocument()
    })
  })

  it("surfaces a ScrapeCreators API error without crashing", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: { configured: true, credits_remaining: null, credits_used_today: null, requests_today: null, error: "boom" },
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/couldn't reach scrapecreators: boom/i)).toBeInTheDocument()
    })
  })

  it("prompts to configure Bright Data when no key is set", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: brightDataNotConfigured,
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/no bright data api key configured/i)).toBeInTheDocument()
    })
  })

  it("shows balance and pending charge when Bright Data is configured", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: { configured: true, balance_usd: 42.5, pending_balance_usd: 1.25, error: null },
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("$42.50 balance")).toBeInTheDocument()
      expect(screen.getByText("$1.25 pending next cycle")).toBeInTheDocument()
    })
  })

  it("surfaces a Bright Data API error without crashing", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: [],
      scrape_creators: scrapeCreatorsNotConfigured,
      bright_data: { configured: true, balance_usd: null, pending_balance_usd: null, error: "boom" },
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/couldn't reach bright data: boom/i)).toBeInTheDocument()
    })
  })
})
