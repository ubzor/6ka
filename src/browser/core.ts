import { chromium, type Page, type Browser } from 'rebrowser-playwright'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Initializes a browser instance with optional authentication state
 * @returns The Playwright Browser object
 */
export async function initializeBrowser(): Promise<Browser> {
    // Launch a visible Chrome browser instance
    return await chromium.launch({
        headless: false
    })
}

/**
 * Initializes a page with the browser context and navigates to 5ka.ru
 * @param browser The browser instance to use
 * @returns The Playwright Page object for further interaction
 */
export async function initializePage(browser: Browser): Promise<Page> {
    const authStatePath = path.join(process.cwd(), 'authState.json')

    // Check if we have a saved authentication state
    const hasAuthState = fs.existsSync(authStatePath)

    // Create context with or without the stored authentication state
    const context = hasAuthState
        ? await browser.newContext({ storageState: authStatePath })
        : await browser.newContext()

    const page = await context.newPage()

    // Navigate to 5ka.ru and wait for the page to load completely
    await page.goto('https://5ka.ru/', { waitUntil: 'networkidle' })

    return page
}
