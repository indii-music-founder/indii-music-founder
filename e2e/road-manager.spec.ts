import { test, expect } from './fixtures/auth';

/**
 * Road Manager (Touring) Module E2E Tests
 * Covers: module load, Tour Parameters waypoint entry, honest route-draft save
 * (user_inputs_only contract), schedule-only check, stop edit, route-draft
 * delete, live waypoint sync, and the On-the-Road nearby-places scan.
 *
 * The generateItinerary/checkLogistics mocks mirror the exact runtime contracts
 * the client validators (`isRouteDraftResponse`, `isScheduleReview`) enforce —
 * the route draft is Planning-typed with empty venues, never fabricated shows.
 */

test.describe('Road Manager Module', () => {
    const rawUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4242";
    const origin = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const corsHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
    };

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock generateItinerary — must satisfy the client-side
        // isRouteDraftResponse validator: Planning stops with empty venues,
        // user_inputs_only authority, and one stop per submitted waypoint.
        await page.route(/.*generateItinerary.*/i, async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        status: 'route_draft',
                        authority: 'user_inputs_only',
                        stops: [
                            {
                                date: '2026-06-08',
                                city: 'Austin, TX',
                                venue: '',
                                activity: 'Planning',
                                type: 'Planning',
                                notes: '',
                            },
                            {
                                date: '2026-06-12',
                                city: 'Houston, TX',
                                venue: '',
                                activity: 'Planning',
                                type: 'Planning',
                                notes: '',
                            },
                        ],
                        limitations: [
                            'Waypoints remain in the order entered by the user.',
                            'Road routing, distance, drive time, traffic, venue availability, and budget are not calculated.',
                        ],
                    },
                }),
            });
        });

        // Mock checkLogistics — must satisfy isScheduleReview (schedule-only scope).
        await page.route(/.*checkLogistics.*/i, async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        scope: 'schedule_only',
                        hasConflicts: false,
                        issues: [],
                        suggestions: [],
                        summary: 'No date-order or same-day multi-city conflicts were found within the limited check scope.',
                        limitations: [
                            'This check covers date order and same-day multi-city conflicts only.',
                            'Road distance, drive time, traffic, venue availability, staffing, and operational feasibility are not verified.',
                        ],
                    },
                }),
            });
        });

        // Mock findPlaces Firebase function
        await page.route(/.*findPlaces.*/i, async route => {
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        places: [
                            {
                                name: 'E2E Gas Station A',
                                vicinity: '123 Main St, Dallas, TX',
                                geometry: {
                                    location: { lat: 32.7767, lng: -96.7970 }
                                },
                                isOpen: true
                            },
                            {
                                name: 'E2E Gas Station B',
                                vicinity: '456 Oak Rd, Dallas, TX',
                                geometry: {
                                    location: { lat: 32.7801, lng: -96.8001 }
                                },
                                isOpen: false
                            }
                        ]
                    }
                }),
            });
        });

        await page.waitForSelector('#root', { timeout: 15_000 });

        // Dismiss first-run guided tour overlay
        await page.evaluate(() => {
            localStorage.setItem("indii_tour_completed_v1", "true");
            window.dispatchEvent(new CustomEvent('indii:dismiss_tour'));
        });

        const nav = page.locator('[data-testid="nav-item-road"]');
        await nav.waitFor({ state: 'visible', timeout: 15_000 });
        await nav.click();
        await page.waitForSelector('text=Tour Parameters', { timeout: 15_000 });
    });

    test('navigates to road manager module and displays components', async ({ authedPage: page }) => {
        await expect(page.locator('text=Tour Parameters')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('#newLocation')).toBeVisible();
        await expect(page.locator('text=Route Waypoints')).toBeVisible();
        // Fresh editor: no waypoint counter overlay until the user adds one.
        await expect(page.getByText('Total Waypoints')).toBeHidden();
    });

    test('saves an honest route draft, checks schedule, edits and deletes the draft', async ({ authedPage: page }) => {
        // Fill dates
        await page.locator('#startDate').fill('2026-06-08');
        await page.locator('#endDate').fill('2026-06-12');

        // Add Austin, TX waypoint
        const waypointsInput = page.locator('#newLocation');
        await waypointsInput.fill('Austin, TX');
        await page.getByRole('button', { name: 'Add location' }).click();
        await expect(page.getByLabel('Remove Austin, TX')).toBeVisible({ timeout: 5_000 });

        // Add Houston, TX waypoint
        await waypointsInput.fill('Houston, TX');
        await waypointsInput.press('Enter');
        await expect(page.getByLabel('Remove Houston, TX')).toBeVisible({ timeout: 5_000 });

        // Live waypoint counter mirrors the editor list
        const waypointsOverlay = page.getByText('Total Waypoints').locator('..');
        await expect(waypointsOverlay.getByText('2', { exact: true })).toBeVisible();

        // Save the route draft (user_inputs_only — venues stay unset)
        await page.getByRole('button', { name: 'Save Route Draft' }).click();

        await expect(page.getByText('Route Draft', { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('cell', { name: 'Austin, TX' })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'Houston, TX' })).toBeVisible();
        // Honest draft contract: no fabricated venues or distances.
        await expect(page.getByText('TBD').first()).toBeVisible(); // bypass-strict: one TBD venue cell per draft row; presence is the assertion
        await expect(page.getByText('Not checked').first()).toBeVisible(); // bypass-strict: one road-distance cell per row; presence is the assertion

        // Run the schedule-only check
        await page.getByRole('button', { name: 'Check Schedule' }).click();
        await expect(page.getByRole('button', { name: 'Schedule Checked' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/within the limited check scope/)).toBeVisible();

        // Open the edit modal and modify the venue
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click(); // bypass-strict: one Edit action per itinerary row; editing the first row is the intent
        await expect(page.getByText('Edit Route Stop')).toBeVisible({ timeout: 5_000 });

        const editVenueInput = page.locator('#editVenue');
        await editVenueInput.fill('Mohawk Austin');
        await page.getByRole('button', { name: 'Save Changes' }).click();

        await expect(page.getByText('Mohawk Austin')).toBeVisible({ timeout: 5_000 });

        // Waypoints the user typed stay authoritative after the draft saves
        await expect(page.getByLabel('Remove Austin, TX')).toBeVisible();

        // Delete the draft through the confirmation dialog
        await page.getByRole('button', { name: 'Delete Draft' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5_000 });
        await dialog.getByRole('button', { name: 'Delete Draft' }).click();

        await expect(page.getByText('Route Draft', { exact: true })).toBeHidden({ timeout: 10_000 });
        // The editor keeps the user's waypoint list; only the saved record is gone.
        await expect(page.getByLabel('Remove Austin, TX')).toBeVisible();
    });

    test('keeps newly added waypoints visible without saving the draft', async ({ authedPage: page }) => {
        const waypointsInput = page.locator('#newLocation');
        await waypointsInput.fill('Toledo, OH');
        await page.getByRole('button', { name: 'Add location' }).click();

        await expect(page.getByLabel('Remove Toledo, OH')).toBeVisible({ timeout: 5_000 });
        const waypointsOverlay = page.getByText('Total Waypoints').locator('..');
        await expect(waypointsOverlay.getByText('1', { exact: true })).toBeVisible();
    });

    test('verifies on the road tab: switches tabs and scans nearby gas stations', async ({ authedPage: page }) => {
        // Switch tab to On the Road
        await page.getByRole('button').filter({ hasText: 'On the Road' }).click();
        await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible({ timeout: 10_000 });

        // Enter current location
        const locationInput = page.getByPlaceholder('Current City, State or coordinates (e.g. Austin, TX)');
        await locationInput.fill('Dallas, TX');

        // Scan gas stations
        const scanBtn = locationInput.locator('..').locator('button').nth(1); // bypass-strict: target specific indexed action button in control cluster
        await scanBtn.click();

        // Verify nearby places are rendered in list
        await expect(page.getByText('E2E Gas Station A')).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('E2E Gas Station B')).toBeVisible({ timeout: 10_000 });
    });
});
