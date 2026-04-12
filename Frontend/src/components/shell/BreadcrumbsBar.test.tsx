import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BreadcrumbsBar from "./BreadcrumbsBar";

describe("BreadcrumbsBar", () => {
  it("renders links for intermediate crumbs and page for last", () => {
    render(
      <MemoryRouter>
        <BreadcrumbsBar
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Learning management", href: "/resources" },
            { label: "Browse catalog" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Browse catalog")).toHaveAttribute("aria-current", "page");
  });
});
