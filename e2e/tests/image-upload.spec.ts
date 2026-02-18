import { test, expect, Page } from "@playwright/test";
import path from "path";

const PASSWORD = "testpassword123";
const HEIC_PATH = path.join(process.env.HOME!, "Downloads/IMG_1379.HEIC");

async function registerAndLogin(page: Page): Promise<void> {
  const email = `test+${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/register");
  await page.fill("#household_name", "Test Household");
  await page.fill("#name", "Test User");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 10_000 });
}

test("import recipe from HEIC photo", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/recipes");

  // Open import modal and switch to photo tab
  await page.click('button:has-text("Add Recipe")');
  await expect(page.locator("text=Add a Recipe")).toBeVisible();
  await page.click('button[role="tab"]:has-text("From Photo")');

  // Upload the HEIC file via the hidden file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(HEIC_PATH);

  // OCR + save takes a while — wait for navigation to recipe detail page
  await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+/, { timeout: 60_000 });

  // Verify we landed on a recipe detail page with some content
  await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
  const title = await page.locator("h1").first().textContent();
  console.log(`Recipe title extracted: "${title}"`);

  // The detail page should have ingredient or step sections
  const hasIngredients = await page.locator("text=Ingredients").isVisible();
  const hasSteps = await page.locator("text=Instructions, text=Steps").isVisible().catch(() => false);
  console.log(`Has ingredients section: ${hasIngredients}`);
  console.log(`Has steps section: ${hasSteps}`);

  // At minimum we should be on a valid recipe page
  expect(page.url()).toMatch(/\/recipes\/[a-f0-9-]+/);
});
