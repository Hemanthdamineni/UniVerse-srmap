import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StarRating } from "./Progress";

describe("StarRating", () => {
  it("uses one radio tab stop and supports arrow navigation", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StarRating value={3} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((radio) => radio.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
    await user.click(radios[2]);
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(4);
  });
});
