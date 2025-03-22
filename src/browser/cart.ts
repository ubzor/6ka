import { type Page } from 'rebrowser-playwright'
import { CartItem } from '../types'

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
