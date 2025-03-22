import {
    chromium,
    type Page,
    type Browser,
    type BrowserContext
} from 'rebrowser-playwright'
import * as path from 'path'
import * as fs from 'fs'

import { CartItem } from './types'

//
// CORE BROWSER FUNCTIONS
//

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

//
// AUTHENTICATION FUNCTIONS
//

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

//
// CART FUNCTIONS
//

/**
 * Checks if the cart is empty
 * @param page The Playwright Page object
 * @returns True if the cart is not empty and has a clean button, false otherwise
 */
export async function checkCartStatus(page: Page): Promise<boolean> {
    // Navigate to the cart page
    await page.goto('https://5ka.ru/cart/', { waitUntil: 'networkidle' })

    try {
        // Check if the clear button exists with a short timeout
        const clearButton = await page.waitForSelector(
            'button:has-text("Очистить")'
        )

        // If we reach here, the button exists and the cart is not empty
        return true
    } catch (error) {
        // Button not found, cart is likely empty
        console.log('Cart is empty or clear button not found')
        return false
    }
}

/**
 * Cleans the cart by clicking the "Очистить" button and confirming
 * @param page The Playwright Page object
 * @returns True if the cart was cleaned successfully, false otherwise
 */
export async function cleanCart(page: Page): Promise<boolean> {
    try {
        // Click the "Очистить" (Clean) button
        await page.click('button:has-text("Очистить")')

        // Wait for the confirmation dialog
        await page.waitForSelector(
            '.chakra-modal__footer button:has-text("Очистить")'
        )

        // Click the confirmation button
        await page.click('.chakra-modal__footer button:has-text("Очистить")')

        // Wait for the cart to be cleaned (network requests to complete)
        await page.waitForLoadState('networkidle')

        return true
    } catch (error) {
        console.error('Error cleaning cart:', error)
        return false
    }
}

/**
 * Parses cart items from the page
 * @param page The Playwright Page object
 * @returns An array of cart items with name, price, and quantity
 */
export async function parseCartItems(page: Page): Promise<CartItem[]> {
    try {
        // Start from the deletion buttons and navigate to find product details
        const items = await page.evaluate(() => {
            const cartItems = []

            // Find all deletion buttons using aria-label attribute
            const deletionButtons = Array.from(
                document.querySelectorAll(
                    'button[aria-label="удаление-товара-из-корзины"]'
                )
            )

            for (const button of deletionButtons) {
                // Navigate up to the main item container (button → parent → parent)
                // This should be the div.chakra-stack wrapper
                const buttonParent = button.parentElement
                if (!buttonParent) continue

                const itemContainer = buttonParent.parentElement
                if (!itemContainer) continue

                // Get the first child of the container which contains name and price
                const infoContainer =
                    itemContainer.firstElementChild as HTMLElement
                if (!infoContainer) continue

                // Find product name (first p element in the info container)
                let name = 'Unknown Product'
                const nameElement = infoContainer.querySelector('p')
                if (nameElement && nameElement.textContent) {
                    name = nameElement.textContent.trim()
                }

                // Find price elements (div with price inside the info container)
                let price = 0
                const priceDiv = infoContainer.querySelector('div')
                if (priceDiv) {
                    // Collect all the numeric price parts (excluding the currency symbol)
                    const priceElements = Array.from(
                        priceDiv.querySelectorAll('p')
                    ).filter(
                        (el) => el.textContent && !el.textContent.includes('₽')
                    )

                    // Combine the price parts (e.g. "154" + "79" = "15479")
                    const priceText = priceElements
                        .map((el) => el.textContent?.trim() || '')
                        .join('')

                    // Convert to float (e.g. "15479" → 154.79)
                    if (priceText) {
                        const wholeNumber = priceText.slice(0, -2) || '0'
                        const decimal = priceText.slice(-2) || '00'
                        price = parseFloat(`${wholeNumber}.${decimal}`)
                    }
                }

                // Get quantity (this part seems to be working fine)
                let quantity = '1 шт'
                const quantityParentElement =
                    button.parentElement?.querySelector('div')
                if (quantityParentElement) {
                    const qtyElement = quantityParentElement.querySelector('p')
                    if (qtyElement && qtyElement.textContent) {
                        quantity = qtyElement.textContent.trim()
                    }
                }

                cartItems.push({
                    name,
                    price,
                    quantity
                })
            }

            return cartItems
        })

        return items
    } catch (error) {
        console.error('Error parsing cart items:', error)
        return []
    }
}

//
// UTILITY FUNCTIONS
//

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
