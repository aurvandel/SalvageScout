import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ScraperTab from "./ScraperTab"

vi.mock("../../api/client", () => ({
  fetchSettings: vi.fn(),
  updateScraperSettings: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSettings, updateScraperSettings } = clientModule

const baseScraper = {
  provider: "apify",
  available_providers: ["apify", "bright_data", "scrape_creators"],
  bright_data_api_key_masked: null,
  scrape_creators_api_key_masked: null,
  incompatible_filter_names: [],
}

describe("ScraperTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("alert", vi.fn())
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchSettings).mockImplementation(() => new Promise(() => {}))
    render(<ScraperTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders loaded settings after fetching", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByLabelText("Active Provider")).toHaveValue("apify")
  })

  it("displays the masked keys when present", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, bright_data_api_key_masked: "(***bd)", scrape_creators_api_key_masked: "(***sc)" },
      apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.getByText(/\(\*\*\*bd\)/)).toBeInTheDocument() })
    expect(screen.getByText(/\(\*\*\*sc\)/)).toBeInTheDocument()
  })

  it("shows a warning when switching providers strands url-mode filters", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, provider: "scrape_creators", incompatible_filter_names: ["Trucks near me"] },
      apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.getByText(/Trucks near me/)).toBeInTheDocument() })
  })

  it("does not warn about url-mode filters when switching to Bright Data", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, provider: "bright_data", incompatible_filter_names: ["Trucks near me"] },
      apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.queryByText(/Trucks near me/)).not.toBeInTheDocument()
  })

  it("calls updateScraperSettings with correct payload when saving", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: { ...baseScraper, provider: "scrape_creators" }, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.selectOptions(screen.getByLabelText("Active Provider"), "scrape_creators")
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => {
      expect(updateScraperSettings).toHaveBeenCalledWith({ provider: "scrape_creators" })
    })
  })

  it("includes api keys in payload only when provided", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.type(screen.getByLabelText("Bright Data API Key"), "new-bd-key")
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => {
      expect(updateScraperSettings).toHaveBeenCalledWith({
        provider: "apify",
        bright_data_api_key: "new-bd-key",
      })
    })
  })

  it("displays error message when save fails", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    const errorMsg = "Save failed"
    vi.mocked(updateScraperSettings).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })

  it("clears key inputs after successful save", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: { ...baseScraper, bright_data_api_key_masked: "(***bd)" }, apify: {} as any, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const keyInput = screen.getByLabelText("Bright Data API Key") as HTMLInputElement
    await user.type(keyInput, "test-key")
    expect(keyInput.value).toBe("test-key")
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(keyInput.value).toBe("") })
  })
})
