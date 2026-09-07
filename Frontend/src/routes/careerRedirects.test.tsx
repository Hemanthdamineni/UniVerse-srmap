import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { careerRedirectRoutes } from "./careerRedirects";

// B3 / T5.3.2 — the retired per-type career routes redirect to the one
// discovery page with the type pre-applied.
describe("career type redirects", () => {
  const cases = [
    ["/career/jobs", "job"],
    ["/career/internships", "internship"],
    ["/career/hackathons", "hackathon"],
    ["/career/competitions", "competition"],
  ] as const;

  it("registers a redirect for every retired per-type route", () => {
    expect(careerRedirectRoutes.map((r) => r.path).sort()).toEqual(cases.map(([p]) => p).sort());
  });

  it.each(cases)("%s lands on /career/opportunities?type=%s", (from, type) => {
    const router = createMemoryRouter(
      [...careerRedirectRoutes, { path: "/career/opportunities", element: <div>opportunities</div> }],
      { initialEntries: [from] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByText("opportunities")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/career/opportunities");
    expect(router.state.location.search).toBe(`?type=${type}`);
  });
});
