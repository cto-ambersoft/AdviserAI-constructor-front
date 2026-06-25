import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LiveStep } from "@/components/auto-trade/launch-wizard/steps/live-step";

describe("LiveStep", () => {
  it("disables promote until the gate is passed", () => {
    render(
      <LiveStep canPromote={false} isPromoting={false} promoted={false} onPromote={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /promote to live/i })).toBeDisabled();
    expect(screen.getByText(/KPI gate is not passed/i)).toBeInTheDocument();
  });

  it("promotes when the gate is passed", () => {
    const onPromote = vi.fn();
    render(
      <LiveStep canPromote isPromoting={false} promoted={false} onPromote={onPromote} />,
    );
    const button = screen.getByRole("button", { name: /promote to live/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onPromote).toHaveBeenCalled();
  });

  it("shows a confirmation once promoted", () => {
    render(
      <LiveStep canPromote isPromoting={false} promoted onPromote={vi.fn()} />,
    );
    expect(screen.getByText(/promoted to live/i)).toBeInTheDocument();
  });
});
