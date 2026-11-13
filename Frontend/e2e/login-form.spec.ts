import { expect, test } from "@playwright/test";

test.describe("login form", () => {
  test("shows the credential fields and lets students reveal or hide the password", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Registration Number" })).toBeVisible();
    const password = page.getByRole("textbox", { name: "Password" });
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });
});
