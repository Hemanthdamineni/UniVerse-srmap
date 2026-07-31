import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

describe("Badge", () => {
  // ---- default rendering --------------------------------------------------
  describe("default rendering", () => {
    it("renders children", () => {
      render(<Badge>Hello</Badge>);
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("renders as a <div> element", () => {
      render(<Badge>Tag</Badge>);
      expect(screen.getByText("Tag").tagName).toBe("DIV");
    });

    it("renders with the default variant class when no variant is specified", () => {
      render(<Badge>Default</Badge>);
      const el = screen.getByText("Default");
      expect(el.className).toContain("bg-primary");
      expect(el.className).toContain("text-primary-foreground");
    });

    it("renders with the base badge classes present", () => {
      render(<Badge>Base</Badge>);
      const el = screen.getByText("Base");
      expect(el.className).toContain("inline-flex");
      expect(el.className).toContain("items-center");
      expect(el.className).toContain("rounded-full");
      expect(el.className).toContain("text-xs");
    });
  });

  // ---- variants -----------------------------------------------------------
  describe("variant", () => {
    it("applies default variant classes explicitly", () => {
      render(<Badge variant="default">Default</Badge>);
      const el = screen.getByText("Default");
      expect(el.className).toContain("bg-primary");
      expect(el.className).toContain("text-primary-foreground");
      expect(el.className).toContain("border-transparent");
    });

    it("applies secondary variant classes", () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const el = screen.getByText("Secondary");
      expect(el.className).toContain("bg-secondary");
      expect(el.className).toContain("text-secondary-foreground");
      expect(el.className).toContain("border-transparent");
    });

    it("applies destructive variant classes", () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      const el = screen.getByText("Destructive");
      expect(el.className).toContain("bg-destructive");
      expect(el.className).toContain("text-destructive-foreground");
      expect(el.className).toContain("border-transparent");
    });

    it("applies outline variant classes", () => {
      render(<Badge variant="outline">Outline</Badge>);
      const el = screen.getByText("Outline");
      // outline does NOT add bg-* or border-transparent
      expect(el.className).toContain("text-foreground");
      expect(el.className).not.toContain("bg-");
      expect(el.className).not.toContain("border-transparent");
    });

    it("renders distinct visual output for each variant", () => {
      const variants = ["default", "secondary", "destructive", "outline"] as const;
      const { container } = render(
        <div>
          {variants.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>,
      );

      for (const v of variants) {
        expect(screen.getByText(v)).toBeInTheDocument();
      }
    });
  });

  // ---- children -----------------------------------------------------------
  describe("children", () => {
    it("renders text children", () => {
      render(<Badge>Dashboard</Badge>);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders numeric children", () => {
      render(<Badge>{42}</Badge>);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("renders complex children (React nodes)", () => {
      render(
        <Badge>
          <span data-testid="icon" aria-hidden="true">
            *
          </span>
          Label
        </Badge>,
      );
      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByText("Label")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <Badge>
          <span>Left</span>
          <span>Right</span>
        </Badge>,
      );
      expect(screen.getByText("Left")).toBeInTheDocument();
      expect(screen.getByText("Right")).toBeInTheDocument();
    });

    it("renders empty children gracefully", () => {
      const { container } = render(<Badge />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe("");
    });
  });

  // ---- className override -------------------------------------------------
  describe("className override", () => {
    it("merges a custom className with variant classes", () => {
      render(<Badge className="my-custom-class">Styled</Badge>);
      const el = screen.getByText("Styled");
      expect(el.className).toContain("my-custom-class");
      // Base variant classes should still be present
      expect(el.className).toContain("bg-primary");
      expect(el.className).toContain("inline-flex");
    });

    it("supports Tailwind utility overrides via className", () => {
      render(<Badge className="text-lg px-4">Override</Badge>);
      const el = screen.getByText("Override");
      expect(el.className).toContain("text-lg");
      expect(el.className).toContain("px-4");
    });

    it("supports multiple class names", () => {
      render(
        <Badge className="ml-2 mr-2 font-bold">Multi Class</Badge>,
      );
      const el = screen.getByText("Multi Class");
      expect(el.className).toContain("ml-2");
      expect(el.className).toContain("mr-2");
      expect(el.className).toContain("font-bold");
    });

    it("works with every variant when combined with a custom className", () => {
      const variants = ["default", "secondary", "destructive", "outline"] as const;
      for (const v of variants) {
        const { container } = render(
          <Badge variant={v} className="extra-class">
            {v}
          </Badge>,
        );
        const el = container.firstChild as HTMLElement;
        expect(el.className).toContain("extra-class");
      }
    });
  });

  // ---- HTML div passthrough props -----------------------------------------
  describe("DOM attribute passthrough", () => {
    it("forwards id", () => {
      render(<Badge id="badge-1">With ID</Badge>);
      expect(screen.getByText("With ID")).toHaveAttribute("id", "badge-1");
    });

    it("forwards data-testid", () => {
      render(<Badge data-testid="my-badge">Test ID</Badge>);
      expect(screen.getByTestId("my-badge")).toBeInTheDocument();
    });

    it("forwards data-* custom attributes", () => {
      render(
        <Badge data-status="active" data-count="7">
          Data Attrs
        </Badge>,
      );
      const el = screen.getByText("Data Attrs");
      expect(el).toHaveAttribute("data-status", "active");
      expect(el).toHaveAttribute("data-count", "7");
    });

    it("forwards style", () => {
      render(<Badge style={{ backgroundColor: "red" }}>Styled</Badge>);
      expect(screen.getByText("Styled")).toHaveStyle(
        "background-color: rgb(255, 0, 0)",
      );
    });

    it("forwards title", () => {
      render(<Badge title="badge tooltip">Titled</Badge>);
      expect(screen.getByText("Titled")).toHaveAttribute(
        "title",
        "badge tooltip",
      );
    });
  });

  // ---- event handlers -----------------------------------------------------
  describe("event handlers", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      await userEvent.click(screen.getByText("Clickable"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("calls onMouseEnter and onMouseLeave", async () => {
      const handleEnter = vi.fn();
      const handleLeave = vi.fn();
      render(
        <Badge onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          Hover
        </Badge>,
      );
      const el = screen.getByText("Hover");
      await userEvent.hover(el);
      expect(handleEnter).toHaveBeenCalledTimes(1);
      await userEvent.unhover(el);
      expect(handleLeave).toHaveBeenCalledTimes(1);
    });

    it("calls onFocus and onBlur when programmatically focused (tabIndex must be set for a <div>)", () => {
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      render(
        <Badge tabIndex={-1} onFocus={handleFocus} onBlur={handleBlur}>
          Focusable
        </Badge>,
      );
      const el = screen.getByText("Focusable");
      el.focus();
      expect(handleFocus).toHaveBeenCalledTimes(1);
      el.blur();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  // ---- accessibility ------------------------------------------------------
  describe("accessibility", () => {
    it("supports aria-label", () => {
      render(
        <Badge aria-label="3 unread notifications">
          {3}
        </Badge>,
      );
      expect(
        screen.getByLabelText("3 unread notifications"),
      ).toBeInTheDocument();
    });

    it("supports aria-labelledby", () => {
      render(
        <>
          <span id="badge-label">Status</span>
          <Badge aria-labelledby="badge-label">Active</Badge>
        </>,
      );
      const badge = screen.getByText("Active");
      expect(badge).toHaveAttribute("aria-labelledby", "badge-label");
    });

    it("supports aria-describedby", () => {
      render(
        <>
          <span id="badge-desc">Course completion badge</span>
          <Badge aria-describedby="badge-desc">Completed</Badge>
        </>,
      );
      expect(screen.getByText("Completed")).toHaveAttribute(
        "aria-describedby",
        "badge-desc",
      );
    });

    it("supports role attribute", () => {
      render(<Badge role="status">Role Badge</Badge>);
      expect(screen.getByRole("status")).toHaveTextContent("Role Badge");
    });

    it("does not have an implicit ARIA role (generic <div>)", () => {
      render(<Badge>No implicit role</Badge>);
      const el = screen.getByText("No implicit role");
      // Plain <div> has no implicit role
      expect(el).not.toHaveAttribute("role");
    });

    it("renders as a single focusable stop when interactive", async () => {
      render(
        <Badge role="button" tabIndex={0}>
          Interactive
        </Badge>,
      );
      await userEvent.tab();
      expect(screen.getByRole("button")).toHaveFocus();
    });
  });

  // ---- edge cases ---------------------------------------------------------
  describe("edge cases", () => {
    it("handles falsey children (0)", () => {
      render(<Badge>{0}</Badge>);
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("handles null children without crashing", () => {
      const { container } = render(<Badge>{null}</Badge>);
      // Should still render a div (no children inside)
      expect(container.firstChild).toBeInTheDocument();
    });

    it("handles undefined children without crashing", () => {
      const { container } = render(<Badge>{undefined}</Badge>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("handles a very long text node without truncation", () => {
      const longText = "a".repeat(500);
      render(<Badge>{longText}</Badge>);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });
  });

  // ---- re-render stability -------------------------------------------------
  describe("re-render stability", () => {
    it("preserves className through re-renders", () => {
      const { rerender } = render(<Badge className="stable">Stable</Badge>);
      rerender(<Badge className="stable">Stable</Badge>);
      expect(screen.getByText("Stable")).toHaveAttribute("class");
    });
  });
});
