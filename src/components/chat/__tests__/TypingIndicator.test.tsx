import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const mockActiveView = { id: "general", kind: "channel" as const };
const mockTypingAgents: Record<string, string[]> = {};
const mockGetAgent = vi.fn((id: string) => ({ displayName: id }));

vi.mock("@/context/AppContext", () => ({
  useApp: () => ({ activeView: mockActiveView }),
}));

vi.mock("@/context/useData", () => ({
  useData: () => ({
    typingAgents: mockTypingAgents,
    getAgent: (id: string) => mockGetAgent(id),
  }),
}));

// Suppress "use client" directive warning in test environment
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return actual;
});

// Wrap to suppress potential context errors
function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

describe("TypingIndicator", () => {
  it("renders nothing when no agents are typing", async () => {
    // Clear typing agents
    for (const k of Object.keys(mockTypingAgents)) { mockTypingAgents[k] = []; }

    const { TypingIndicator } = await import("../TypingIndicator");
    const { container } = render(<TypingIndicator />, { wrapper: TestWrapper });

    expect(container.innerHTML).toBe("");
  });

  it("shows single agent name with 'is typing'", async () => {
    for (const k of Object.keys(mockTypingAgents)) { mockTypingAgents[k] = []; }
    mockTypingAgents.general = ["dwight"];
    mockGetAgent.mockImplementation((id: string) => ({
      displayName: id === "dwight" ? "Dwight Schrute" : id,
    }));

    const { TypingIndicator } = await import("../TypingIndicator");
    render(<TypingIndicator />, { wrapper: TestWrapper });

    expect(screen.getByText("Dwight Schrute is typing")).toBeDefined();
  });

  it("shows two agent names with 'are typing'", async () => {
    for (const k of Object.keys(mockTypingAgents)) { mockTypingAgents[k] = []; }
    mockTypingAgents.general = ["dwight", "jim"];
    mockGetAgent.mockImplementation((id: string) => {
      const names: Record<string, string> = {
        dwight: "Dwight Schrute",
        jim: "Jim Halpert",
      };
      return { displayName: names[id] ?? id };
    });

    const { TypingIndicator } = await import("../TypingIndicator");
    render(<TypingIndicator />, { wrapper: TestWrapper });

    expect(screen.getByText("Dwight Schrute and Jim Halpert are typing")).toBeDefined();
  });

  it("shows 'N others' when more than two agents are typing", async () => {
    for (const k of Object.keys(mockTypingAgents)) { mockTypingAgents[k] = []; }
    mockTypingAgents.general = ["dwight", "jim", "pam"];
    mockGetAgent.mockImplementation((id: string) => {
      const names: Record<string, string> = {
        dwight: "Dwight Schrute",
        jim: "Jim Halpert",
        pam: "Pam Beesly",
      };
      return { displayName: names[id] ?? id };
    });

    const { TypingIndicator } = await import("../TypingIndicator");
    render(<TypingIndicator />, { wrapper: TestWrapper });

    expect(screen.getByText("Dwight Schrute and 2 others are typing")).toBeDefined();
  });

  it("renders animated dots", async () => {
    for (const k of Object.keys(mockTypingAgents)) { mockTypingAgents[k] = []; }
    mockTypingAgents.general = ["dwight"];
    mockGetAgent.mockImplementation(() => ({ displayName: "Dwight Schrute" }));

    const { TypingIndicator } = await import("../TypingIndicator");
    const { container } = render(<TypingIndicator />, { wrapper: TestWrapper });

    // There should be 3 animated dot spans with animate-bounce class
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots).toHaveLength(3);
  });
});
