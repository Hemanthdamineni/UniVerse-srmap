import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../dialog";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dialog", () => {
  it("renders with closed state by default — no dialog in document", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Test Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Title")).not.toBeInTheDocument();
  });

  it("opens when trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open dialog/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
  });

  it("displays title and description", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
          <DialogDescription>My Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));

    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My Description")).toBeInTheDocument();
  });

  it("closes when the close button (X icon) is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when a custom DialogClose is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          {/* Custom close button alongside the built-in X */}
          <DialogClose>Custom Close</DialogClose>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /custom close/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the overlay is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="dialog-overlay"]',
    );
    expect(overlay).not.toBeNull();
    await user.click(overlay!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when opening and closing", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    onOpenChange.mockClear();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toggles inert attribute on #main-content", async () => {
    // Set up the element that toggleInert looks for
    const main = document.createElement("main");
    main.id = "main-content";
    document.body.appendChild(main);

    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(main).not.toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(main).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(main).not.toHaveAttribute("inert");

    main.remove();
  });

  it("renders dialog content in a portal (outside render container)", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Portal Test</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));

    // Dialog content is portaled to document.body, NOT inside RTL's container
    expect(container.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(
      document.body.querySelector('[data-slot="dialog-content"]'),
    ).toBeInTheDocument();
  });

  it("respects controlled open state", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Controlled Open</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Controlled Open")).toBeInTheDocument();
  });

  it("respects controlled closed state", () => {
    render(
      <Dialog open={false}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Closed</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("handles multiple independent dialogs", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Dialog>
          <DialogTrigger>Open A</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog A</DialogTitle>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger>Open B</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog B</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );

    // Open A
    await user.click(screen.getByRole("button", { name: /open a/i }));
    expect(screen.getByText("Dialog A")).toBeInTheDocument();
    expect(screen.queryByText("Dialog B")).not.toBeInTheDocument();

    // Close A
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Dialog A")).not.toBeInTheDocument();

    // Open B
    await user.click(screen.getByRole("button", { name: /open b/i }));
    expect(screen.getByText("Dialog B")).toBeInTheDocument();
    expect(screen.queryByText("Dialog A")).not.toBeInTheDocument();
  });

  it("passes custom className to DialogContent", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="my-custom-class">
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /open/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("my-custom-class");
  });
});
