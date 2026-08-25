import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ApifyTab from "./ApifyTab"

vi.mock("../../api/client", () => ({
  fetchSettings: vi.fn(),
  updateApifySettings: vi.fn(),
}))

import * as clientModule from "../../api/client"
const { fetchSettings, updateApifySettings } = clientModule

describe("ApifyTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("alert", vi.fn())
  })

  it("renders loading state initially", () => {
    vi.mocked(fetchSettings).mockImplementation(() => new Promise(() => {}))
    render(<ApifyTab />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders loaded settings after fetching", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "***token" },
      llm: {} as any,
      notifications: {} as any,
    })
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    expect(screen.getByDisplayValue("test-actor-123")).toBeInTheDocument()
  })

  it("displays the masked token when present", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any,
      notifications: {} as any,
    })
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.getByText(/\(\*\*\*token\)/)).toBeInTheDocument() })
  })

  it("does not display raw token values", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any,
      notifications: {} as any,
    })
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText(/real.*token/i)).not.toBeInTheDocument() })
  })

  it("calls updateApifySettings with correct payload when saving without token", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateApifySettings).mockResolvedValue({
      apify: { actor_id: "new-actor-456", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const actorIdInput = screen.getByLabelText("Actor ID")
    await user.clear(actorIdInput)
    await user.type(actorIdInput, "new-actor-456")
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(updateApifySettings).toHaveBeenCalledWith({ actor_id: "new-actor-456" }) })
  })

  it("calls updateApifySettings with token when provided", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: null },
      llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateApifySettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const tokenInput = screen.getByLabelText("Apify API Token")
    await user.type(tokenInput, "new-token-value")
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(updateApifySettings).toHaveBeenCalledWith({ actor_id: "test-actor-123", apify_token: "new-token-value" }) })
  })

  it("displays error message when save fails", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    const errorMsg = "Save failed"
    vi.mocked(updateApifySettings).mockRejectedValue(new Error(errorMsg))
    const user = userEvent.setup()
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(screen.getByText(errorMsg)).toBeInTheDocument() })
  })

  it("disables save button while saving", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    let resolveUpdateApify: any
    const updatePromise = new Promise((resolve) => { resolveUpdateApify = resolve })
    vi.mocked(updateApifySettings).mockReturnValue(updatePromise as any)
    const user = userEvent.setup()
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(saveButton).toBeDisabled() })
    resolveUpdateApify({ apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" }, llm: {} as any, notifications: {} as any })
    await waitFor(() => { expect(saveButton).not.toBeDisabled() })
  })

  it("clears token input after successful save", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: null },
      llm: {} as any, notifications: {} as any,
    })
    vi.mocked(updateApifySettings).mockResolvedValue({
      apify: { actor_id: "test-actor-123", apify_token_masked: "(***token)" },
      llm: {} as any, notifications: {} as any,
    })
    const user = userEvent.setup()
    render(<ApifyTab />)
    await waitFor(() => { expect(screen.queryByText("Loading...")).not.toBeInTheDocument() })
    const tokenInput = screen.getByLabelText("Apify API Token") as HTMLInputElement
    await user.type(tokenInput, "test-token")
    expect(tokenInput.value).toBe("test-token")
    const saveButton = screen.getByRole("button", { name: /save apify settings/i })
    await user.click(saveButton)
    await waitFor(() => { expect(tokenInput.value).toBe("") })
  })
})
