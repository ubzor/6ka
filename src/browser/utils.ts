import { type Page } from 'rebrowser-playwright'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Takes a screenshot of the current page state and saves it to the screenshots directory
 * @param page The Playwright Page object
 * @param name Optional name to include in the screenshot filename
 * @returns Path to the saved screenshot
 */
export async function takeScreenshot(
    page: Page,
    name: string = 'screenshot'
): Promise<string> {
    // Ensure the screenshots directory exists
    const screenshotDir = path.join(process.cwd(), 'screenshots')
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true })
    }

    // Create a timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const screenshotPath = path.join(screenshotDir, `${name}-${timestamp}.png`)

    // Take the screenshot
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`Screenshot saved to: ${screenshotPath}`)

    return screenshotPath
}

/**
 * Handles any errors during browser operations by taking a screenshot of what the browser sees
 * @param page The Playwright Page object
 * @param operation A function containing the operation that might throw an error
 * @param errorName Optional name to include in the screenshot filename
 * @returns The result of the operation if successful
 */
export async function handleError<T>(
    page: Page,
    operation: () => Promise<T>,
    errorName: string = 'error'
): Promise<T> {
    try {
        return await operation()
    } catch (error: any) {
        console.error(`Error occurred: ${error.message}`)

        // Take a screenshot of what the browser currently sees at the time of error
        const screenshotPath = await takeScreenshot(page, errorName)
        console.error(`Error screenshot saved to: ${screenshotPath}`)

        // Re-throw the error after taking the screenshot
        throw error
    }
}
