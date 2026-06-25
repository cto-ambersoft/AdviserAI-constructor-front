import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

import { ExchangeStep } from "@/components/auto-trade/launch-wizard/steps/exchange-step";
import type { ExchangeAccountRead } from "@/lib/api";

const account = {
  id: 5,
  account_label: "main",
  exchange_name: "binance",
  mode: "futures",
} as unknown as ExchangeAccountRead;

describe("ExchangeStep", () => {
  it("links to Connect Exchange when no account is connected", () => {
    render(
      <ExchangeStep data={{}} dispatch={vi.fn()} accounts={[]} isLoading={false} />,
    );
    expect(
      screen.getByRole("link", { name: /connect an exchange/i }),
    ).toHaveAttribute("href", "/settings/connect-exchange");
  });

  it("records account + position size selections", () => {
    const dispatch = vi.fn();
    render(
      <ExchangeStep
        data={{}}
        dispatch={dispatch}
        accounts={[account]}
        isLoading={false}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "5" } });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set",
      patch: { accountId: 5 },
    });

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 100/i), {
      target: { value: "100" },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set",
      patch: { positionSizeUsdt: 100 },
    });
  });

  it("rejects an out-of-range position size", () => {
    const dispatch = vi.fn();
    render(
      <ExchangeStep
        data={{}}
        dispatch={dispatch}
        accounts={[account]}
        isLoading={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 100/i), {
      target: { value: "9999999999" },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set",
      patch: { positionSizeUsdt: undefined },
    });
  });

  it("warns that a real account won't trade in sandbox", () => {
    const realAccount = {
      id: 7,
      account_label: "live",
      exchange_name: "binance",
      mode: "real",
    } as unknown as ExchangeAccountRead;
    render(
      <ExchangeStep
        data={{ accountId: 7 }}
        dispatch={vi.fn()}
        accounts={[realAccount]}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/won't place orders until you promote/i)).toBeInTheDocument();
  });

  it("warns when the size is below the typical minimum notional", () => {
    render(
      <ExchangeStep
        data={{ accountId: 5, positionSizeUsdt: 50 }}
        dispatch={vi.fn()}
        accounts={[account]}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/100 usdt/i)).toBeInTheDocument();
  });
});
