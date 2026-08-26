import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import UsageTab from "./UsageTab"

vi.mock("../../api/client", () => ({
  fetchUsage: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchUsage } = clientModule

const emptyLLMRows: any[] = []

describe("UsageTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchUsage).mockImplementation(() => new Promise(() => {}))
    render(<UsageTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("prompts to configure Apify when no token is set", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: { configured: false, used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: null },
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText(/no apify token configured/i)).toBeInTheDocument()
    })
  })

  it("shows used vs limit when Apify is configured", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: {
        configured: true,
        used_usd: 12.5,
        limit_usd: 300,
        cycle_start: "2026-08-01T00:00:00Z",
        cycle_end: "2026-08-31T23:59:59Z",
        error: null,
      },
      llm_this_month: emptyLLMRows,
      llm_all_time: emptyLLMRows,
    })
    render(<UsageTab />)
    await waitFor(() => {
      expect(screen.getByText("$12.50 used")).toBeInTheDocument()
      expect(screen.getByText("$300.00 monthly limit")).toBeInTheDocument()
    })
  })

  it("surfaces an Apify API error without crashing", async () => {
    vi.mocked(fetchUsage).mockResolvedValue({
      apify: { configured: true, used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: "boom" },
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
      apify: { configured: false, used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: null },
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
      apify: { configured: false, used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: null },
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
      apify: { configured: false, used_usd: null, limit_usd: null, cycle_start: null, cycle_end: null, error: null },
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
})
