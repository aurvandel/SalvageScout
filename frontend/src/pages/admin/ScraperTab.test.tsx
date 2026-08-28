import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ScraperTab from "./ScraperTab"

vi.mock("../../api/client", () => ({
  fetchSettings: vi.fn(),
  updateApifySettings: vi.fn(),
  updateScraperSettings: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSettings, updateApifySettings, updateScraperSettings } = clientModule

const baseScraper = {
  provider: "apify",
  available_providers: ["apify", "scrape_creators"],
  bright_data_api_key_masked: null,
  bright_data_enrichment_enabled: false,
  scrape_creators_api_key_masked: null,
  incompatible_filter_names: [],
}

const baseApify = {
  actor_id: "test-actor-123",
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
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByLabelText("Active Provider")).toHaveValue("apify")
    // Bright Data isn't a provider choice, only Apify/ScrapeCreators.
    expect(screen.getByLabelText("Active Provider")).not.toHaveTextContent("Bright Data")
    expect(screen.getByDisplayValue("test-actor-123")).toBeInTheDocument()
  })

  it("displays the masked keys when present", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, bright_data_api_key_masked: "(***bd)", scrape_creators_api_key_masked: "(***sc)" },
      apify: baseApify,
      llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.getByText(/\(\*\*\*bd\)/)).toBeInTheDocument() })
    expect(screen.getByText(/\(\*\*\*sc\)/)).toBeInTheDocument()
  })

  it("shows a warning when switching to a provider that can't consume url-mode filters", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, provider: "scrape_creators", incompatible_filter_names: ["Trucks near me"] },
      apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.getByText(/Trucks near me/)).toBeInTheDocument() })
  })

  it("reflects the saved enrichment toggle state", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: { ...baseScraper, bright_data_enrichment_enabled: true },
      apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("calls updateScraperSettings with correct payload when saving", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: { ...baseScraper, provider: "scrape_creators" }, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.selectOptions(screen.getByLabelText("Active Provider"), "scrape_creators")
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => {
      expect(updateScraperSettings).toHaveBeenCalledWith({
        provider: "scrape_creators",
        bright_data_enrichment_enabled: false,
      })
    })
  })

  it("includes the enrichment toggle and api keys in the save payload", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    await user.click(screen.getByRole("checkbox"))
    await user.type(screen.getByLabelText("Bright Data API Key"), "new-bd-key")
    const saveButton = screen.getByRole("button", { name: /save scraper settings/i })
    await user.click(saveButton)
    await waitFor(() => {
      expect(updateScraperSettings).toHaveBeenCalledWith({
        provider: "apify",
        bright_data_enrichment_enabled: true,
        bright_data_api_key: "new-bd-key",
      })
    })
  })

  it("displays error message when scraper save fails", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
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

  it("clears key inputs after successful scraper save", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateScraperSettings).mockResolvedValue({
      scraper: { ...baseScraper, bright_data_api_key_masked: "(***bd)" }, apify: baseApify, llm: {} as any, notifications: {} as any,
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

  it("calls updateApifySettings with the actor id when saving", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateApifySettings).mockResolvedValue({
      scraper: baseScraper, apify: { actor_id: "new-actor-456" }, llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const actorIdInput = screen.getByLabelText("Actor ID")
    await user.clear(actorIdInput)
    await user.type(actorIdInput, "new-actor-456")
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(updateApifySettings).toHaveBeenCalledWith({ actor_id: "new-actor-456" }) })
  })

  it("offers the known actor IDs as datalist suggestions while allowing free text", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    const { container } = render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const actorIdInput = screen.getByLabelText("Actor ID")
    expect(actorIdInput).toHaveAttribute("list", "actor-id-options")
    const optionValues = Array.from(
      container.querySelectorAll("#actor-id-options option"),
      (option) => (option as HTMLOptionElement).value
    )
    expect(optionValues).toEqual(["apify/facebook-marketplace-scraper", "curious_coder/facebook-marketplace"])
  })

  it("displays error message when apify save fails", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      scraper: baseScraper, apify: baseApify, llm: {} as any, notifications: {} as any,
    })
    const errorMsg = "Apify save failed"
    vi.mocked(updateApifySettings).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<ScraperTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })
})
