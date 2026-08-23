import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, emphasis, and links from markdown source", () => {
    render(
      <Markdown>
        {"# Unit 1\n\nSome **bold** and a [link](https://example.com)."}
      </Markdown>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Unit 1");
    // streamdown renders emphasis tokens as spans with font-weight utilities
    expect(screen.getByText("bold")).toHaveClass("font-semibold");
    const link = screen.getByRole("link", { name: "link" });
    // streamdown's URL transform normalizes bare hosts with a trailing slash
    expect(link).toHaveAttribute("href", "https://example.com/");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders GFM tables", () => {
    render(
      <Markdown>
        {"| State | Marked |\n| ----- | ------ |\n| A     | yes    |"}
      </Markdown>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders fenced code blocks with language chrome and a copy button", () => {
    render(<Markdown>{"```ts\nconst x: number = 1;\n```"}</Markdown>);

    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
    expect(screen.getByText(/const x/)).toBeInTheDocument();
  });

  it("renders shell fences as command cards with a prompt prefix", () => {
    render(<Markdown>{"```bash\nnpm run build\n```"}</Markdown>);

    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("npm run build")).toBeInTheDocument();
  });

  it("renders inline code without block chrome", () => {
    render(<Markdown>{"Run `npm test` now."}</Markdown>);

    expect(screen.queryByRole("button", { name: /copy code/i })).toBeNull();
    expect(screen.getByText("npm test").tagName).toBe("CODE");
  });

  it("renders task lists", () => {
    render(<Markdown>{"- [x] done\n- [ ] todo"}</Markdown>);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  describe("math", () => {
    it("renders inline $…$ automatically via KaTeX", () => {
      const { container } = render(<Markdown>{"Energy: $E=mc^2$ indeed."}</Markdown>);

      expect(container.querySelector(".katex")).not.toBeNull();
      expect(container.querySelector(".katex")).toHaveTextContent("E=mc2");
    });

    it("renders display $$…$$ as a centered block", () => {
      const { container } = render(<Markdown>{"$$\\int_0^1 x^2\\,dx$$"}</Markdown>);

      expect(container.querySelector(".katex-display")).not.toBeNull();
    });

    it("normalizes Pandoc \\(…\\) and \\[…\\] delimiters", () => {
      const { container } = render(
        <Markdown>{"Given \\(\\alpha_i\\) and:\n\\[x = b\\]"}</Markdown>,
      );

      expect(container.querySelectorAll(".katex").length).toBe(2);
      // Rendered glyph appears; the raw Pandoc delimiters do not.
      expect(container.textContent).toContain("α");
      expect(container.querySelectorAll(".katex-html")[1]).toHaveTextContent("x=b");
    });

    it("leaves currency amounts as literal text (no TeX markers, digit-led)", () => {
      const { container } = render(
        <Markdown>{"Stipend $1,200 to $1,500 per month."}</Markdown>,
      );

      expect(container.querySelector(".katex")).toBeNull();
      expect(container.textContent).toContain("$1,200");
    });

    it("keeps dollar signs inside code blocks untouched", () => {
      const { container } = render(<Markdown>{"```\ncost=$100\n```"}</Markdown>);

      expect(container.querySelector(".katex")).toBeNull();
      expect(container.textContent).toContain("cost=$100");
    });

    it("renders math inside tables and list items", () => {
      const { container } = render(
        <Markdown>{"- item $a_1$\n\n| Expr |\n| ---- |\n| $b^2$ |"}</Markdown>,
      );

      // one for list inline math, one for table cell
      expect(container.querySelectorAll(".katex").length).toBe(2);
    });
  });
});
