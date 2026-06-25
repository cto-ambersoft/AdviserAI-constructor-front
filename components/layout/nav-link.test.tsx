import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const segmentMock = vi.fn<() => string | null>();

vi.mock("next/navigation", () => ({
  useSelectedLayoutSegment: () => segmentMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import { NavLink } from "@/components/layout/nav-link";
import { PRIMARY_NAV } from "@/lib/navigation";

const autoTrade = PRIMARY_NAV.find((item) => item.segment === "auto-trade")!;

describe("NavLink", () => {
  it("marks the link active when the selected layout segment matches", () => {
    segmentMock.mockReturnValue("auto-trade");
    render(<NavLink item={autoTrade} />);
    expect(screen.getByRole("link", { name: autoTrade.label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is not active when the segment differs", () => {
    segmentMock.mockReturnValue("monitor");
    render(<NavLink item={autoTrade} />);
    expect(
      screen.getByRole("link", { name: autoTrade.label }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders an href to the item destination", () => {
    segmentMock.mockReturnValue(null);
    render(<NavLink item={autoTrade} />);
    expect(screen.getByRole("link", { name: autoTrade.label })).toHaveAttribute(
      "href",
      autoTrade.href,
    );
  });
});
