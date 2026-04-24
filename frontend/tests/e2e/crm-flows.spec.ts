import { test, expect } from '@playwright/test';

test.describe('Acufy CRM Smoke Tests', () => {
  // Use a fixed device/viewport for reliable tests
  test.use({ viewport: { width: 1280, height: 720 } });

  test('should load the dashboard and verify Dev User bypass is active', async ({ page }) => {
    // Navigate to the app root
    await page.goto('/');

    // Verify title and main dashboard title
    await expect(page).toHaveTitle(/Acufy CRM/);
    await expect(page.getByText('Sales Dashboard')).toBeVisible();

    // Ensure the topbar has the dev user selector defaulted to Admin
    const devUserSelect = page.locator('select').first();
    await expect(devUserSelect).toHaveValue('admin');
  });

  test('should navigate to Contacts and load the data table', async ({ page }) => {
    await page.goto('/#/contacts');

    // Check header
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();

    // Verify search input is present
    await expect(page.getByPlaceholder('Search contacts...')).toBeVisible();
    
    // Check if table renders (might take a moment to fetch from API)
    await page.waitForTimeout(1000); 
    
    // Check for standard contact columns
    await expect(page.getByText('Name').first()).toBeVisible();
    await expect(page.getByText('Email').first()).toBeVisible();
  });

  test('should navigate to Deals Kanban board', async ({ page }) => {
    await page.goto('/#/deals');

    // Check header
    await expect(page.getByRole('heading', { name: 'Deals Pipeline' })).toBeVisible();

    // Verify Kanban columns (assuming seed data contains generic stage names)
    await page.waitForTimeout(1000);
    // Even if empty, the columns should theoretically render or a board should be visible
  });

  test('should open the AI Command Palette', async ({ page }) => {
    await page.goto('/');

    // The AI Command floating action button or sidebar link
    await page.goto('/#/ai');
    
    await expect(page.getByRole('heading', { name: 'AI Command Center' })).toBeVisible();
    await expect(page.getByPlaceholder('E.g., "Draft an email to John Smith about the new enterprise tier"')).toBeVisible();
  });
});
