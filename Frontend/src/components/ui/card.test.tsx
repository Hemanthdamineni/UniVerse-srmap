import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "../card";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
describe("Card", () => {
  it("renders children", () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it('has correct data-slot="card"', () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText("Hello")).toHaveAttribute("data-slot", "card");
  });

  it("merges className", () => {
    render(<Card className="custom-card">Hello</Card>);
    const el = screen.getByText("Hello");
    expect(el.className).toContain("custom-card");
  });

  it("forwards DOM attributes", () => {
    render(<Card id="main-card" data-testid="card">Hello</Card>);
    const el = screen.getByTestId("card");
    expect(el).toHaveAttribute("id", "main-card");
  });
});

// ---------------------------------------------------------------------------
// CardHeader
// ---------------------------------------------------------------------------
describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });

  it('has correct data-slot="card-header"', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toHaveAttribute(
      "data-slot",
      "card-header",
    );
  });

  it("merges className", () => {
    render(<CardHeader className="custom-header">Header</CardHeader>);
    const el = screen.getByText("Header");
    expect(el.className).toContain("custom-header");
  });

  it("forwards aria-* attributes", () => {
    render(
      <CardHeader aria-label="card header section" data-testid="header">
        Header
      </CardHeader>,
    );
    const el = screen.getByTestId("header");
    expect(el).toHaveAttribute("aria-label", "card header section");
  });
});

// ---------------------------------------------------------------------------
// CardTitle
// ---------------------------------------------------------------------------
describe("CardTitle", () => {
  it("renders title text", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it('has correct data-slot="card-title"', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title")).toHaveAttribute(
      "data-slot",
      "card-title",
    );
  });

  it("merges className", () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.className).toContain("custom-title");
  });

  it("renders complex children (React nodes)", () => {
    render(
      <CardTitle>
        <span data-testid="nested">Nested</span>
      </CardTitle>,
    );
    expect(screen.getByTestId("nested")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CardDescription
// ---------------------------------------------------------------------------
describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it('has correct data-slot="card-description"', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText("Description")).toHaveAttribute(
      "data-slot",
      "card-description",
    );
  });

  it("merges className", () => {
    render(
      <CardDescription className="custom-desc">Description</CardDescription>,
    );
    const el = screen.getByText("Description");
    expect(el.className).toContain("custom-desc");
  });
});

// ---------------------------------------------------------------------------
// CardContent
// ---------------------------------------------------------------------------
describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it('has correct data-slot="card-content"', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText("Content")).toHaveAttribute(
      "data-slot",
      "card-content",
    );
  });

  it("merges className with non-conflicting utility", () => {
    render(<CardContent className="p-0">Content</CardContent>);
    const el = screen.getByText("Content");
    expect(el.className).toContain("p-0");
  });

  it("renders multiple children", () => {
    render(
      <CardContent>
        <span>First</span>
        <span>Second</span>
      </CardContent>,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CardFooter
// ---------------------------------------------------------------------------
describe("CardFooter", () => {
  it("renders children", () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it('has correct data-slot="card-footer"', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer")).toHaveAttribute(
      "data-slot",
      "card-footer",
    );
  });

  it("merges className", () => {
    render(<CardFooter className="custom-footer">Footer</CardFooter>);
    const el = screen.getByText("Footer");
    expect(el.className).toContain("custom-footer");
  });

  it("renders multiple action elements", () => {
    render(
      <CardFooter>
        <button type="button">Save</button>
        <button type="button">Cancel</button>
      </CardFooter>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CardAction
// ---------------------------------------------------------------------------
describe("CardAction", () => {
  it("renders children", () => {
    render(<CardAction>Action</CardAction>);
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it('has correct data-slot="card-action"', () => {
    render(<CardAction>Action</CardAction>);
    expect(screen.getByText("Action")).toHaveAttribute(
      "data-slot",
      "card-action",
    );
  });

  it("merges className", () => {
    render(<CardAction className="custom-action">Action</CardAction>);
    const el = screen.getByText("Action");
    expect(el.className).toContain("custom-action");
  });
});

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------
describe("Integration", () => {
  it("composed card layout with header/content/footer", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Desc")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("card with CardAction alongside header", () => {
    render(
      <Card>
        <CardHeader>Header</CardHeader>
        <CardAction>Action</CardAction>
      </Card>,
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------
describe("Accessibility", () => {
  it("Card has no implicit role", () => {
    render(<Card>Content</Card>);
    const el = screen.getByText("Content");
    expect(el).not.toHaveAttribute("role");
  });

  it("CardHeader has no implicit role", () => {
    render(<CardHeader>Header</CardHeader>);
    const el = screen.getByText("Header");
    expect(el).not.toHaveAttribute("role");
  });

  it("all subcomponents support aria-* attributes", () => {
    render(
      <Card aria-label="accessible card">
        <CardHeader aria-label="header">Header</CardHeader>
        <CardContent aria-label="content">Content</CardContent>
        <CardFooter aria-label="footer">Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByLabelText("accessible card")).toBeInTheDocument();
    expect(screen.getByLabelText("header")).toBeInTheDocument();
    expect(screen.getByLabelText("content")).toBeInTheDocument();
    expect(screen.getByLabelText("footer")).toBeInTheDocument();
  });

  it("CardTitle is a <div> (not a semantic heading)", () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    const el = screen.getByTestId("title");
    expect(el.tagName).toBe("DIV");
  });
});
