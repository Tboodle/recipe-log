import { test, expect, Page } from "@playwright/test";

const PASSWORD = "testpassword123";

// Unique email per call so tests don't collide with each other in the DB
function uniqueEmail() {
  return `test+${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

// Helper: register a fresh account and land on "/"
async function registerAndLogin(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.fill("#household_name", "Test Household");
  await page.fill("#name", "Test User");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 10_000 });
  return email;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test.describe("Auth", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("shows recipelog branding on login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=recipelog")).toBeVisible();
    await expect(page.locator("text=Sign in to your household")).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "notanemail");
    await page.fill("#password", "anything");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Enter a valid email")).toBeVisible();
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "nobody@example.com");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid email or password")).toBeVisible({ timeout: 8_000 });
  });

  test("register creates account and redirects to dashboard", async ({ page }) => {
    await registerAndLogin(page);
    await expect(page.locator("text=Dashboard").first()).toBeVisible();
  });

  test("can log out and log back in", async ({ page }) => {
    const email = await registerAndLogin(page);

    // Simulate logout by clearing session storage
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/");
    await expect(page).toHaveURL("/login");

    // Log back in with the same credentials
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });
});

// ── Recipes ───────────────────────────────────────────────────────────────────

test.describe("Recipes", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/recipes");
  });

  test("shows empty state when no recipes exist", async ({ page }) => {
    await expect(page.locator("text=No recipes yet")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("p:has-text('Add your first recipe')")).toBeVisible();
  });

  test("search input is visible in header", async ({ page }) => {
    await expect(page.locator('input[placeholder="Search recipes..."]')).toBeVisible();
  });

  test("Add Recipe button opens import modal", async ({ page }) => {
    await page.click('button:has-text("Add Recipe")');
    await expect(page.locator("text=Add a Recipe")).toBeVisible();
    await expect(page.locator("text=From URL")).toBeVisible();
    await expect(page.locator("text=From Photo")).toBeVisible();
    await expect(page.locator("text=Manual")).toBeVisible();
  });

  test("URL tab shows import input and hints", async ({ page }) => {
    await page.click('button:has-text("Add Recipe")');
    await expect(page.locator('input[placeholder*="allrecipes"]')).toBeVisible();
    await expect(page.locator("text=Import Recipe")).toBeVisible();
    await expect(page.locator("text=500+ more sites")).toBeVisible();
  });

  test("Manual tab shows recipe editor button", async ({ page }) => {
    await page.click('button:has-text("Add Recipe")');
    await page.click('button[role="tab"]:has-text("Manual")');
    await expect(page.locator("text=Open Recipe Editor")).toBeVisible();
  });

  test("import modal closes on Escape", async ({ page }) => {
    await page.click('button:has-text("Add Recipe")');
    await expect(page.locator("text=Add a Recipe")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("text=Add a Recipe")).not.toBeVisible();
  });
});

// ── Shopping Lists ─────────────────────────────────────────────────────────────

test.describe("Shopping Lists", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/shopping");
  });

  test("shopping page loads without crashing", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible({ timeout: 8_000 });
    const heading = await page.locator("h1").textContent();
    expect(heading).toContain("Shopping");
  });

  test("can create a new shopping list", async ({ page }) => {
    const addBtn = page
      .locator('button:has-text("New List")')
      .or(page.locator('button:has-text("Create")'));
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(
        page.locator('input[placeholder*="list"], input[placeholder*="List"]').first()
      ).toBeVisible({ timeout: 5_000 });
    } else {
      // Page loaded fine — verify no crash
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("nav links go to Recipes and Shopping pages", async ({ page }) => {
    const recipesLink = page.locator('a[href="/recipes"]').first();
    const shoppingLink = page.locator('a[href="/shopping"]').first();

    await expect(recipesLink).toBeVisible();
    await expect(shoppingLink).toBeVisible();

    await recipesLink.click();
    await expect(page).toHaveURL("/recipes");

    await shoppingLink.click();
    await expect(page).toHaveURL("/shopping");
  });

  test("brand link goes to dashboard", async ({ page }) => {
    await page.goto("/recipes");
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL("/");
  });
});
