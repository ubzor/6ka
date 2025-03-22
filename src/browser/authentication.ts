import { type Page, type BrowserContext } from 'rebrowser-playwright'
import * as path from 'path'

/**
 * Checks if the user is already logged in
 * @param page The Playwright Page object
 * @returns True if the user is logged in, false otherwise
 */
export async function isUserLoggedIn(page: Page): Promise<boolean> {
    try {
        // Look for user profile icon that appears when logged in
        // Using waitForSelector with timeout to avoid long wait if element doesn't exist
        await page.waitForSelector('[data-qa="user-menu-button"]')

        // Hover over the user menu button to reveal user-specific elements
        await page.hover('[data-qa="user-menu-button"]')

        // Wait for the menu list to appear after hovering
        await page.waitForSelector('.chakra-menu__menu-list')

        // Check if "Выйти" (Logout) text is present in the menu
        const dropdownMenu = page.locator('.chakra-menu__menu-list').first()

        return (await dropdownMenu.textContent()) !== 'Войти'
    } catch (error) {
        // If an error occurs (e.g., timeout waiting for selector), user is likely not logged in
        console.log(
            'Error checking login status, assuming not logged in:',
            error
        )
        return false
    }
}

/**
 * Navigates to the 5ka login page, inputs the phone number,
 * and waits for the verification code input to appear
 * @param page The Playwright Page object
 */
export async function login(page: Page): Promise<void> {
    // Hover over the user menu button
    await page.hover('[data-qa="user-menu-button"]')

    // Wait for the login button and click it
    await page.waitForSelector('[data-qa="user-login-button"]')
    await page.click('[data-qa="user-login-button"]')

    // Wait for network activity to settle after clicking
    await page.waitForLoadState('networkidle')

    // Wait for the login form to render
    await page.waitForSelector('#kc-form-login #username')

    // Input the phone number
    await page.fill('#kc-form-login #username', process.env.PHONE_NUMBER || '')

    // Click the submit button
    await page.click('#fake_submit_button')

    // Wait for the verification code field to appear
    await page.waitForSelector('#code1')
}

/**
 * Inputs the verification code sent to the user's phone
 * @param page The Playwright Page object
 * @param code The 4-digit verification code
 * @returns Path to the screenshot taken after authentication
 */
export async function inputVerificationCode(
    page: Page,
    code: string
): Promise<void> {
    // The verification code is split into 4 separate input fields
    const digits = code.split('')

    // Use keyboard press to enter each digit sequentially
    for (let i = 0; i < digits.length; i++) {
        const inputSelector = `#code${i + 1}`

        // Make sure the element is visible and interactable
        await page.waitForSelector(inputSelector)

        // Click on the input field first to focus it
        await page.click(inputSelector)

        // Press the digit key with slight delay to simulate real typing
        await page.keyboard.press(digits[i], { delay: 100 })
    }

    // Wait for navigation to complete after entering verification code
    await Promise.all([
        page.waitForLoadState('networkidle'),
        page.waitForLoadState('domcontentloaded')
    ])

    console.log('Verification code entered successfully, navigated to new page')

    // Save the authenticated browser state
    await saveAuthState(page.context())
}

/**
 * Saves the authenticated browser state to a file
 * @param context The browser context to save
 * @returns Path to the saved state file
 */
export async function saveAuthState(context: BrowserContext): Promise<string> {
    // Create a filename for the state
    const statePath = path.join('authState.json')

    // Save the state to the file
    await context.storageState({ path: statePath })
    console.log(`Authentication state saved to: ${statePath}`)

    return statePath
}
