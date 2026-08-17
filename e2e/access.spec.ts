import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the two paths that must hold before anything else: a
 * signed-out visitor never sees the register, and the sign-in page renders
 * without JavaScript doing the work.
 *
 * The flows behind sign-in need OAuth credentials and a database; they are
 * covered by the isolation integration test until a seeded test account exists.
 */
test("a signed-out visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/docket");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Docket" })).toBeVisible();
});

test("the root routes signed-out visitors to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the sign-in page keeps the callback it was given", async ({ page }) => {
  await page.goto("/docket/import");
  await expect(page).toHaveURL(/callbackUrl=%2Fdocket%2Fimport/);
});

test("settings are not reachable while signed out", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in/);
});
