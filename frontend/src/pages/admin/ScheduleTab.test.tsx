import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ScheduleTab from "./ScheduleTab"

vi.mock("../../api/client", () => ({
  fetchSchedulerConfig: vi.fn(),
  updateSchedulerConfig: vi.fn(),
  triggerSearch: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSchedulerConfig, updateSchedulerConfig, triggerSearch } = clientModule

describe("ScheduleTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("alert", vi.fn())
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchSchedulerConfig).mockImplementation(() => new Promise(() => {}))
    render(<ScheduleTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders loaded scheduler configuration", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 30, updated_at: "2026-08-25T10:00:00Z",
    })
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByDisplayValue("6")).toBeInTheDocument()
  })

  it("displays scheduler configuration after loading", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 8, run_minute: 15, updated_at: "2026-08-24T12:00:00Z",
    })
    render(<ScheduleTab />)
    await waitFor(() => {
      expect(screen.getByDisplayValue("8")).toBeInTheDocument()
      expect(screen.getByDisplayValue("15")).toBeInTheDocument()
    })
  })

  it("calls updateSchedulerConfig on save", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    vi.mocked(updateSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T11:00:00Z",
    })
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save configuration/i })
    await user.click(saveButton)
    await waitFor(() => { expect(updateSchedulerConfig).toHaveBeenCalled() })
  })

  it("displays error when save fails", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    const errorMsg = "Failed to update scheduler config"
    vi.mocked(updateSchedulerConfig).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save configuration/i })
    await user.click(saveButton)
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })

  it("disables save button while saving", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    let resolveUpdate: any
    const updatePromise = new Promise((resolve) => { resolveUpdate = resolve })
    vi.mocked(updateSchedulerConfig).mockReturnValue(updatePromise as any)
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save configuration/i })
    await user.click(saveButton)
    await waitFor(() => { expect(saveButton).toBeDisabled() })
    resolveUpdate({ id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z" })
    await waitFor(() => { expect(saveButton).not.toBeDisabled() })
  })

  it("toggles scheduler enabled state", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    vi.mocked(updateSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: false, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const checkbox = screen.getByLabelText("Enable Scheduler")
    await user.click(checkbox)
    const saveButton = screen.getByRole("button", { name: /save configuration/i })
    await user.click(saveButton)
    await waitFor(() => { expect(updateSchedulerConfig).toHaveBeenCalled() })
  })

  it("hides time picker when scheduler is disabled", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: false, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.queryByLabelText("Hour (UTC)")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Minute")).not.toBeInTheDocument()
  })

  it("shows time picker when scheduler is enabled", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    render(<ScheduleTab />)
    await waitFor(() => {
      expect(screen.getByLabelText("Hour (UTC)")).toBeInTheDocument()
      expect(screen.getByLabelText("Minute")).toBeInTheDocument()
    })
  })

  it("triggers search and displays success message", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    vi.mocked(triggerSearch).mockResolvedValue({ message: "Search triggered successfully" })
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const runButton = screen.getByRole("button", { name: /run now/i })
    await user.click(runButton)
    await waitFor(() => { expect(screen.getByText(/search triggered successfully/i)).toBeInTheDocument() })
  })

  it("displays error when triggering search fails", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    const errorMsg = "Failed to trigger search"
    vi.mocked(triggerSearch).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const runButton = screen.getByRole("button", { name: /run now/i })
    await user.click(runButton)
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })

  it("disables run button while triggering search", async () => {
    vi.mocked(fetchSchedulerConfig).mockResolvedValue({
      id: 1, is_enabled: true, run_hour: 6, run_minute: 0, updated_at: "2026-08-25T10:00:00Z",
    })
    let resolveTrigger: any
    const triggerPromise = new Promise((resolve) => { resolveTrigger = resolve })
    vi.mocked(triggerSearch).mockReturnValue(triggerPromise as any)
    const user = userEvent.setup()
    render(<ScheduleTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const runButton = screen.getByRole("button", { name: /run now/i })
    await user.click(runButton)
    await waitFor(() => { expect(runButton).toBeDisabled() })
    resolveTrigger({ message: "Success" })
    await waitFor(() => { expect(runButton).not.toBeDisabled() })
  })
})
