import { test, expect } from '@playwright/test';
import type { EventsResponse } from '../src/types/event';

const mockEventsResponse: EventsResponse = {
  data: [
    {
      id: 'evt-001',
      isoDate: '02-17',
      source: { type: 'wikipedia', sourceUrl: 'https://en.wikipedia.org/wiki/Test' },
      title: 'Treaty of Paris signed',
      description: 'The Treaty of Paris was signed, ending the war and reshaping European borders.',
      year: 1763,
      categories: ['political', 'military'],
      location: {
        type: 'Point',
        coordinates: [2.35, 48.86],
        confidence: 'high',
        geocoder: 'curated',
        placeName: 'Paris',
      },
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'evt-002',
      isoDate: '02-17',
      source: { type: 'wikipedia', sourceUrl: 'https://en.wikipedia.org/wiki/Test2' },
      title: 'First electric streetcar in Richmond',
      description: 'The first successful electric streetcar system began operation in Richmond, Virginia.',
      year: 1888,
      categories: ['scientific'],
      location: {
        type: 'Point',
        coordinates: [-77.43, 37.54],
        confidence: 'high',
        geocoder: 'nominatim',
        placeName: 'Richmond',
      },
      createdAt: '2025-01-01T00:00:00Z',
    },
  ],
  meta: { total: 2, fictional: 0, cacheHit: true },
};

test.beforeEach(async ({ page }) => {
  // Intercept API calls and return mock data
  await page.route('**/api/v1/events?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEventsResponse) }),
  );
});

test.describe('Chrono Atlas E2E', () => {
  test('loads the app and displays the globe', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Chrono Atlas/ })).toBeVisible();
    await expect(page.locator('svg[role="img"]')).toBeVisible();
  });

  test('shows event count after loading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });
  });

  test('date picker navigates days', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    // Click next day arrow
    await page.getByLabel('Next day').click();
    // The date display should change (we can't predict exact date but the API is called again)
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a pin shows event detail card', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    // Click on a pin (the pins are g elements with role="button" inside the SVG)
    const pins = page.locator('svg g[role="button"]');
    await expect(pins.first()).toBeVisible({ timeout: 5_000 });
    await pins.first().click();

    // Event detail card should appear with event info
    await expect(page.getByRole('heading', { name: 'Treaty of Paris signed' }).or(page.getByRole('heading', { name: 'First electric streetcar in Richmond' }))).toBeVisible({ timeout: 5_000 });
  });

  test('closing event detail card hides it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    const pins = page.locator('svg g[role="button"]');
    await expect(pins.first()).toBeVisible({ timeout: 5_000 });
    await pins.first().click();

    // Wait for detail card
    const closeButton = page.getByLabel('Close');
    await expect(closeButton).toBeVisible({ timeout: 5_000 });

    // Close the card
    await closeButton.click();

    // Card should fade out (750ms animation)
    await expect(closeButton).toBeHidden({ timeout: 2_000 });
  });

  test('zoom controls work', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg[role="img"]')).toBeVisible();

    const zoomIn = page.getByLabel('Zoom in');
    const zoomOut = page.getByLabel('Zoom out');
    const resetView = page.getByLabel('Reset view');

    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();
    await expect(resetView).toBeVisible();

    // Click zoom in/out and verify no errors
    await zoomIn.click();
    await page.waitForTimeout(400);
    await zoomOut.click();
    await page.waitForTimeout(400);
    await resetView.click();
  });

  test('full flow: load → select pin → view detail → close → navigate date', async ({ page }) => {
    await page.goto('/');

    // 1. App loads with events
    await expect(page.getByRole('heading', { name: /Chrono Atlas/ })).toBeVisible();
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    // 2. Click a pin
    const pins = page.locator('svg g[role="button"]');
    await expect(pins.first()).toBeVisible({ timeout: 5_000 });
    await pins.first().click();

    // 3. Detail card appears
    await expect(page.getByLabel('Close')).toBeVisible({ timeout: 5_000 });

    // 4. Close the card
    await page.getByLabel('Close').click();
    await expect(page.getByLabel('Close')).toBeHidden({ timeout: 2_000 });

    // 5. Navigate to next day
    await page.getByLabel('Next day').click();
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    // 6. Navigate to previous day
    await page.getByLabel('Previous day').click();
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });
  });

  test('Wikipedia link opens in new tab', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    const pins = page.locator('svg g[role="button"]');
    await expect(pins.first()).toBeVisible({ timeout: 5_000 });
    await pins.first().click();

    // Check Wikipedia link exists with target="_blank"
    const wikiLink = page.getByRole('link', { name: /Wikipedia/ });
    await expect(wikiLink).toBeVisible({ timeout: 5_000 });
    await expect(wikiLink).toHaveAttribute('target', '_blank');
  });

  test('keyboard navigation: pin is focusable and activatable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('2 events')).toBeVisible({ timeout: 10_000 });

    // Tab to the first pin (it has tabindex=0)
    const pin = page.locator('svg g[role="button"]').first();
    await expect(pin).toBeVisible({ timeout: 5_000 });
    await pin.focus();
    await page.keyboard.press('Enter');

    // Detail card should appear
    await expect(page.getByLabel('Close')).toBeVisible({ timeout: 5_000 });
  });
});
