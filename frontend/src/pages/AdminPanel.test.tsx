import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminPanel from "./AdminPanel"

// Mock all six tab components
vi.mock("./admin/LLMTab", () => ({
  default: () => <div data-testid="llm-tab">LLM Tab</div>,
}))

vi.mock("./admin/ApifyTab", () => ({
  default: () => <div data-testid="apify-tab">Apify Tab</div>,
}))

vi.mock("./admin/NotificationsTab", () => ({
  default: () => <div data-testid="notifications-tab">Notifications Tab</div>,
}))

vi.mock("./admin/SearchFiltersTab", () => ({
  default: () => <div data-testid="search-tab">Search Filters Tab</div>,
}))

vi.mock("./admin/ScheduleTab", () => ({
  default: () => <div data-testid="schedule-tab">Schedule Tab</div>,
}))

vi.mock("./admin/ArenaTab", () => ({
  default: () => <div data-testid="arena-tab">Arena Tab</div>,
}))

describe("AdminPanel", () => {
  it("renders the admin panel title", () => {
    render(<AdminPanel />)
    expect(screen.getByRole("heading", { level: 1, name: "Admin Panel" })).toBeInTheDocument()
  })

  it("renders all six tab buttons", () => {
    render(<AdminPanel />)
    expect(screen.getByRole("button", { name: "LLM" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apify" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Search Filters" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Arena" })).toBeInTheDocument()
  })

  it("renders the LLM tab by default", () => {
    render(<AdminPanel />)
    expect(screen.getByTestId("llm-tab")).toBeInTheDocument()
  })

  it("hides other tabs when LLM tab is active", () => {
    render(<AdminPanel />)
    expect(screen.queryByTestId("apify-tab")).not.toBeInTheDocument()
    expect(screen.queryByTestId("notifications-tab")).not.toBeInTheDocument()
    expect(screen.queryByTestId("search-tab")).not.toBeInTheDocument()
    expect(screen.queryByTestId("schedule-tab")).not.toBeInTheDocument()
    expect(screen.queryByTestId("arena-tab")).not.toBeInTheDocument()
  })

  it("marks the LLM tab button as active by default", () => {
    render(<AdminPanel />)
    const llmButton = screen.getByRole("button", { name: "LLM" })
    expect(llmButton).toHaveClass("active")
  })

  it("switches to Apify tab when clicked", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const apifyButton = screen.getByRole("button", { name: "Apify" })
    await user.click(apifyButton)
    expect(screen.getByTestId("apify-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
  })

  it("marks Apify tab button as active after clicking it", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const apifyButton = screen.getByRole("button", { name: "Apify" })
    await user.click(apifyButton)
    expect(apifyButton).toHaveClass("active")
    expect(screen.getByRole("button", { name: "LLM" })).not.toHaveClass("active")
  })

  it("switches to Notifications tab when clicked", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const notificationsButton = screen.getByRole("button", { name: "Notifications" })
    await user.click(notificationsButton)
    expect(screen.getByTestId("notifications-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
  })

  it("switches to Search Filters tab when clicked", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const searchButton = screen.getByRole("button", { name: "Search Filters" })
    await user.click(searchButton)
    expect(screen.getByTestId("search-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
  })

  it("switches to Schedule tab when clicked", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const scheduleButton = screen.getByRole("button", { name: "Schedule" })
    await user.click(scheduleButton)
    expect(screen.getByTestId("schedule-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
  })

  it("switches to Arena tab when clicked", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const arenaButton = screen.getByRole("button", { name: "Arena" })
    await user.click(arenaButton)
    expect(screen.getByTestId("arena-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
  })

  it("allows switching between multiple tabs", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    expect(screen.getByTestId("llm-tab")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Apify" }))
    expect(screen.getByTestId("apify-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("llm-tab")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Schedule" }))
    expect(screen.getByTestId("schedule-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("apify-tab")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "LLM" }))
    expect(screen.getByTestId("llm-tab")).toBeInTheDocument()
    expect(screen.queryByTestId("schedule-tab")).not.toBeInTheDocument()
  })

  it("updates active class on tab buttons when switching", async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)
    const llmButton = screen.getByRole("button", { name: "LLM" })
    const apifyButton = screen.getByRole("button", { name: "Apify" })
    const scheduleButton = screen.getByRole("button", { name: "Schedule" })
    expect(llmButton).toHaveClass("active")
    expect(apifyButton).not.toHaveClass("active")
    await user.click(apifyButton)
    expect(llmButton).not.toHaveClass("active")
    expect(apifyButton).toHaveClass("active")
    expect(scheduleButton).not.toHaveClass("active")
    await user.click(scheduleButton)
    expect(llmButton).not.toHaveClass("active")
    expect(apifyButton).not.toHaveClass("active")
    expect(scheduleButton).toHaveClass("active")
  })
})
