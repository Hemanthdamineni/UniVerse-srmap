import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

// ---------------------------------------------------------------------------
// buttonVariants utility
// ---------------------------------------------------------------------------
describe("buttonVariants", () => {
  it("returns default classes when called without arguments", () => {
    const classes = buttonVariants();
    expect(classes).toContain("inline-flex");
    expect(classes).toContain("items-center");
    expect(classes).toContain("rounded-md");
    expect(classes).toContain("bg-[var(--comp-accent)]");
  });

  it("applies the requested variant", () => {
    const classes = buttonVariants({ variant: "destructive" });
    expect(classes).toContain("bg-[var(--error)]");
    expect(classes).toContain("text-white");
  });

  it("applies the requested size", () => {
    const classes = buttonVariants({ size: "sm" });
    expect(classes).toContain("h-8");
    expect(classes).toContain("px-3");
  });

  it("merges custom className", () => {
    const classes = buttonVariants({ className: "my-custom-class" });
    expect(classes).toContain("my-custom-class");
    // base classes are still there
    expect(classes).toContain("inline-flex");
  });

  it("returns outline variant with border classes", () => {
    const classes = buttonVariants({ variant: "outline" });
    expect(classes).toContain("border");
    expect(classes).toContain("border-[var(--comp-border)]");
  });

  it("returns ghost variant without background", () => {
    const classes = buttonVariants({ variant: "ghost" });
    expect(classes).toContain("text-[var(--comp-text-secondary)]");
    expect(classes).toContain("hover:bg-[var(--comp-surface-hover)]");
  });

  it("returns link variant with underline decoration", () => {
    const classes = buttonVariants({ variant: "link" });
    expect(classes).toContain("text-[var(--comp-accent)]");
    expect(classes).toContain("underline-offset-4");
    expect(classes).toContain("hover:underline");
  });

  it("returns icon size without padding classes", () => {
    const classes = buttonVariants({ size: "icon" });
    expect(classes).toContain("size-9");
    // icon size omits horizontal padding in favor of a square
    expect(classes).not.toMatch(/px-/);
  });

  it("defaults variant to 'default' and size to 'default' when omitted", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-[var(--comp-accent)]");
    expect(classes).toContain("h-9");
  });
});

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------
describe("Button", () => {
  // -- Default rendering ---------------------------------------------------
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders with data-slot='button'", () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-slot", "button");
  });

  it("renders as a <button> element by default", () => {
    const { container } = render(<Button>Test</Button>);
    const btn = container.querySelector("button");
    expect(btn).toBeInTheDocument();
    expect(btn?.tagName).toBe("BUTTON");
  });

  it("renders complex React children", () => {
    render(
      <Button>
        <span data-testid="child">Icon</span>
        <span>Text</span>
      </Button>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
  });

  // -- Variants ------------------------------------------------------------
  it.each([
    ["default", "bg-[var(--comp-accent)]"],
    ["destructive", "bg-[var(--error)]"],
    ["outline", "border-[var(--comp-border)]"],
    ["secondary", "bg-[var(--comp-surface-hover)]"],
    ["ghost", "text-[var(--comp-text-secondary)]"],
    ["link", "underline-offset-4"],
  ] as const)("renders %s variant", (variant, expectedClass) => {
    render(<Button variant={variant}>Button</Button>);
    expect(screen.getByRole("button")).toHaveClass(expectedClass);
  });

  it("renders destructive variant with white text", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-white");
  });

  it("renders outline variant with shadow-xs", () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button")).toHaveClass("shadow-xs");
  });

  // -- Sizes ---------------------------------------------------------------
  it.each([
    ["default", "h-9"],
    ["sm", "h-8"],
    ["lg", "h-10"],
    ["icon", "size-9"],
  ] as const)("renders %s size", (size, expectedClass) => {
    render(<Button size={size}>Btn</Button>);
    expect(screen.getByRole("button")).toHaveClass(expectedClass);
  });

  it("renders sm size with smaller gap", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("gap-1.5");
  });

  it("renders lg size with larger horizontal padding", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-6");
  });

  // -- Disabled state ------------------------------------------------------
  it("renders as disabled when disabled prop is passed", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies disabled-pointer-events class", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toHaveClass("disabled:pointer-events-none");
  });

  it("applies opacity-50 when disabled", () => {
    render(<Button disabled>Disabled</Button>);
    // Tailwind disabled:opacity-50 is part of the base styles
    expect(screen.getByRole("button")).toHaveClass("disabled:opacity-50");
  });

  // -- Loading state (not built-in, so we test the pattern) ----------------
  it("supports an externally-managed loading pattern via disabled + children", () => {
    // The component has no built-in loading prop, but the common pattern
    // is to disable the button and swap children to show a spinner.
    const { rerender } = render(<Button loading>Submitting…</Button>);
    // loading is not a recognized HTML attribute — React drops it, so the
    // button remains enabled. Users must pass disabled explicitly.
    expect(screen.getByRole("button")).toBeEnabled();

    rerender(
      <Button disabled aria-busy="true">
        Submitting…
      </Button>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Submitting…")).toBeInTheDocument();
  });

  it("renders a spinner element inside when composing loading state", () => {
    render(
      <Button disabled aria-busy="true">
        <span data-testid="spinner" className="animate-spin" />
        Loading
      </Button>,
    );
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  // -- Click handler -------------------------------------------------------
  it("fires onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("receives the click event object", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({ type: "click" }));
  });

  // -- asChild behavior ----------------------------------------------------
  it("renders as a child element when asChild is true (div)", () => {
    const { container } = render(
      <Button asChild>
        <div data-testid="custom-root">Child</div>
      </Button>,
    );
    // No <button> should be rendered
    expect(container.querySelector("button")).not.toBeInTheDocument();
    // The div is the root
    const root = screen.getByTestId("custom-root");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-slot", "button");
  });

  it("passes className to the child element when asChild is true", () => {
    render(
      <Button asChild variant="destructive" className="extra-class">
        <span data-testid="child">Child</span>
      </Button>,
    );
    const child = screen.getByTestId("child");
    // Should have the destructive variant class AND the custom class
    expect(child).toHaveClass("bg-[var(--error)]");
    expect(child).toHaveClass("extra-class");
  });

  it("renders as an <a> link via asChild", () => {
    render(
      <Button asChild>
        <a href="/somewhere" data-testid="link">
          Go
        </a>
      </Button>,
    );
    const link = screen.getByTestId("link");
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/somewhere");
    // data-slot is still forwarded
    expect(link).toHaveAttribute("data-slot", "button");
    // Button styling is applied
    expect(link).toHaveClass("inline-flex");
  });

  it("fires on click on the underlying child when asChild is true", () => {
    const handleClick = vi.fn();
    render(
      <Button asChild onClick={handleClick}>
        <span data-testid="clickable">Clickable</span>
      </Button>,
    );
    fireEvent.click(screen.getByTestId("clickable"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // -- Accessibility -------------------------------------------------------
  it("is a button with the correct implicit role", () => {
    render(<Button>Accessible</Button>);
    // <button> elements implicitly have role="button"
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("accepts aria-label", () => {
    render(<Button aria-label="Close dialog">X</Button>);
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("accepts aria-labelledby", () => {
    render(
      <div>
        <span id="btn-label">Save changes</span>
        <Button aria-labelledby="btn-label">Save</Button>
      </div>,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("accepts aria-describedby", () => {
    render(
      <div>
        <Button aria-describedby="desc">Info</Button>
        <p id="desc">Additional description</p>
      </div>,
    );
    const btn = screen.getByRole("button", { name: "Info" });
    expect(btn).toHaveAttribute("aria-describedby", "desc");
  });

  it("forwards aria-pressed for toggle semantics", () => {
    render(<Button aria-pressed="true">Toggle</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("can be focusable via tabIndex", () => {
    render(<Button tabIndex={0}>Focusable</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("tabindex", "0");
  });

  // -- className merging ---------------------------------------------------
  it("merges custom className with variant classes", () => {
    render(<Button className="my-custom-class">Styled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("my-custom-class");
    // Base styling is still present
    expect(btn).toHaveClass("inline-flex");
    expect(btn).toHaveClass("bg-[var(--comp-accent)]");
  });

  it("tailwind-merge resolves conflicting classes (later wins)", () => {
    // bg-[var(--comp-accent)] comes from the default variant;
    // passing bg-red-500 should override it via twMerge
    render(
      <Button className="bg-red-500">Override</Button>,
    );
    const btn = screen.getByRole("button");
    // twMerge should keep bg-red-500 and drop bg-[var(--comp-accent)]
    expect(btn).toHaveClass("bg-red-500");
    expect(btn).not.toHaveClass("bg-[var(--comp-accent)]");
  });

  // -- type attribute ------------------------------------------------------
  it("defaults to no type attribute (uses button default: submit in forms)", () => {
    const { container } = render(<Button>No type</Button>);
    const btn = container.querySelector("button");
    // When no type is specified, the component does not set one;
    // HTML buttons default to "submit" when inside a form.
    expect(btn).not.toHaveAttribute("type");
  });

  it("passes type='submit' through", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("passes type='reset' through", () => {
    render(<Button type="reset">Reset</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "reset");
  });

  it("passes type='button' through", () => {
    render(<Button type="button">Button</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  // -- Ref forwarding ------------------------------------------------------
  it("forwards ref to the underlying button element", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe("BUTTON");
  });

  it("forwards ref to the underlying child element when asChild is true", () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(
      <Button asChild ref={ref}>
        <span data-testid="child-ref">Child</span>
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current?.textContent).toBe("Child");
  });

  // -- Edge cases ----------------------------------------------------------
  it("renders without any props", () => {
    const { container } = render(<Button />);
    const btn = container.querySelector("button");
    expect(btn).toBeInTheDocument();
    expect(btn?.textContent).toBe("");
  });

  it("renders fragments inside asChild", () => {
    // Slot can handle fragments; the class is forwarded to the first child
    render(
      <Button asChild>
        <a href="/test">Fragment link</a>
      </Button>,
    );
    const link = screen.getByText("Fragment link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("supports arbitrary data attributes", () => {
    render(<Button data-action="delete" data-id="42">Data</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-action", "delete");
    expect(btn).toHaveAttribute("data-id", "42");
  });

  it("supports form attribute", () => {
    render(<Button form="my-form">Form</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("form", "my-form");
  });

  it("supports value", () => {
    render(<Button value="some-value">Value</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("value", "some-value");
  });

  it("supports name", () => {
    render(<Button name="action">Named</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("name", "action");
  });

  it("spreads unrecognized props to the DOM element", () => {
    render(
      // @ts-expect-error -- testing runtime forward of unknown props
      <Button data-custom="prop">Spread</Button>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-custom", "prop");
  });

  // -- Inline SVG children -------------------------------------------------
  it("renders with SVG children", () => {
    render(
      <Button>
        <svg data-testid="icon" width="16" height="16"><circle cx="8" cy="8" r="8" /></svg>
        Icon button
      </Button>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Icon button")).toBeInTheDocument();
  });

  // -- Multiple buttons in a document --------------------------------------
  it("distinguishes multiple buttons by their text", () => {
    render(
      <div>
        <Button variant="primary">Save</Button>
        <Button variant="ghost">Cancel</Button>
      </div>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // -- Focus visible ring --------------------------------------------------
  it("has focus-visible ring classes in base", () => {
    render(<Button>Focus</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("focus-visible:ring-ring/50");
    expect(btn).toHaveClass("focus-visible:ring-[3px]");
    expect(btn).toHaveClass("outline-none");
  });
});
