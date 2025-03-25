import { Context, InlineKeyboard } from 'grammy'
import {
    BotState,
    CartItem,
    LlmResponse,
    LlmActionItem,
    Product
} from '../types'
import {
    isUserLoggedIn,
    inputVerificationCode,
    checkCartStatus,
    parseCartItems
} from '../browser'
import { callLlmApi } from './llm'
import { BrowserBot } from './BrowserBot'

export async function processVerificationCode(
    bot: BrowserBot,
    ctx: Context,
    code: string
): Promise<void> {
    // Check if the code matches the format: exactly 4 digits
    if (/^\d{4}$/.test(code)) {
        try {
            await ctx.reply('Processing verification code...')

            if (!bot.page) {
                throw new Error('Browser page not initialized')
            }

            // Input the verification code
            await inputVerificationCode(bot.page, code)

            // Reset the state
            bot.state = BotState.ACTIVE

            // Check if we're logged in
            const loggedIn = await isUserLoggedIn(bot.page)

            if (loggedIn) {
                await ctx.reply('Successfully logged in!')

                // Check cart status after successful login
                await checkAndHandleCartStatus(bot, ctx)
            } else {
                await ctx.reply(
                    'Login attempt unsuccessful. Please try again with /neworder.'
                )
                bot.state = BotState.INACTIVE
            }
        } catch (error) {
            console.error('Error processing verification code:', error)
            await ctx.reply(
                'An error occurred while processing the verification code.'
            )
            bot.state = BotState.INACTIVE
        }
    } else {
        await ctx.reply('Invalid code format. Please enter exactly 4 digits.')
    }
}

export async function processLlmRequest(
    bot: BrowserBot,
    ctx: Context,
    text: string
): Promise<void> {
    try {
        await ctx.reply('Processing your request with AI...')

        // Get the AI response with just the prompt and text, without cart items
        const response = await callLlmApi(text, bot.llmPrompt)

        try {
            // Try to parse the response as JSON
            const parsedResponse = JSON.parse(response) as LlmResponse

            // Send the parsed response in a more readable format
            let replyMessage = "Here's what I understood:\n\n"
            let allMatchingItems: CartItem[] = []
            let specificProductsToShow: string[] = []

            // Format the "add" items
            if (parsedResponse.add && parsedResponse.add.length > 0) {
                replyMessage += '✅ Adding to cart:\n'
                parsedResponse.add.forEach((item: LlmActionItem) => {
                    if (item.count === 'MIN') {
                        replyMessage += `• ${item.name}\n`
                    } else if (item.count) {
                        replyMessage += `• ${item.name}: ${item.count} ${
                            item.unit || ''
                        }\n`
                    } else {
                        replyMessage += `• ${item.name}\n`
                    }

                    // Find matching products in productsData
                    if (bot.productsData && bot.productsData.products) {
                        const matchingProducts = findMatchingProducts(
                            item.name,
                            bot.productsData.products
                        )

                        // Add specific products to the list, avoiding duplicates
                        matchingProducts.forEach((product) => {
                            product.specificProducts.forEach(
                                (specificProduct) => {
                                    if (
                                        !specificProductsToShow.includes(
                                            specificProduct
                                        )
                                    ) {
                                        specificProductsToShow.push(
                                            specificProduct
                                        )
                                    }
                                }
                            )
                        })
                    }
                })
                replyMessage += '\n'
            }

            // Format the "remove" items
            if (parsedResponse.remove && parsedResponse.remove.length > 0) {
                replyMessage += '❌ Removing from cart:\n'

                for (const itemName of parsedResponse.remove) {
                    replyMessage += `• ${itemName}\n`

                    // Find matching items in the cart and collect them
                    if (bot.cartItems && bot.cartItems.length > 0) {
                        const matchingItems = findMatchingItemsInCart(
                            itemName,
                            bot.cartItems
                        )

                        // Add matching items to the collection, avoiding duplicates
                        matchingItems.forEach((item) => {
                            if (
                                !allMatchingItems.some(
                                    (existingItem) =>
                                        existingItem.name === item.name
                                )
                            ) {
                                allMatchingItems.push(item)
                            }
                        })
                    }
                }
                replyMessage += '\n'
            }

            // First send the main response
            await ctx.reply(replyMessage)

            // Send matching specific products if any
            if (specificProductsToShow.length > 0) {
                const specificProductsMessage = formatSpecificProductsMessage(
                    specificProductsToShow
                )
                await ctx.reply(specificProductsMessage)
            }

            // Then send matching cart items in a separate message if there are any
            if (allMatchingItems.length > 0) {
                const matchingItemsMessage =
                    formatMatchingItemsMessage(allMatchingItems)
                await ctx.reply(matchingItemsMessage)
            }
        } catch (parseError) {
            // If parsing fails, send the raw response
            console.error('Error parsing LLM response:', parseError)
            await ctx.reply(
                `I received a response but couldn't format it properly: ${response}`
            )
        }
    } catch (error) {
        console.error('Error processing LLM request:', error)
        await ctx.reply(
            'Sorry, I encountered an error while processing your request with the AI model.'
        )
    }
}

/**
 * Format a message containing specific products
 */
function formatSpecificProductsMessage(specificProducts: string[]): string {
    let message = 'These specific products match your request:\n\n'
    specificProducts.forEach((product, index) => {
        message += `${index + 1}. ${product}\n`
    })

    return message
}

/**
 * Find products in productsData that match all words in the search query in their aliases
 */
function findMatchingProducts(
    searchQuery: string,
    products: Product[]
): Product[] {
    // Normalize the search query: lowercase and split into individual words
    const searchWords = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0)

    return products.filter((product) => {
        // Check if any alias contains all search words
        return product.aliases.some((alias) => {
            const aliasLower = alias.toLowerCase()
            return searchWords.every((word) => aliasLower.includes(word))
        })
    })
}

/**
 * Format a message containing only the names of matching items
 */
function formatMatchingItemsMessage(items: CartItem[]): string {
    if (items.length === 0) {
        return 'No matching items found in your cart.'
    }

    let message = 'These items in your cart match your removal request:\n\n'
    items.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`
    })

    return message
}

/**
 * Find items in the cart that match all words in the search query
 */
function findMatchingItemsInCart(
    searchQuery: string,
    cartItems: CartItem[]
): CartItem[] {
    // Normalize the search query: lowercase and split into individual words
    const searchWords = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0)

    return cartItems.filter((item) => {
        const itemNameLower = item.name.toLowerCase()
        // Item matches if all words in the search query are present in the item name
        return searchWords.every((word) => itemNameLower.includes(word))
    })
}

export function formatCartMessage(cartItems: CartItem[]): string {
    if (cartItems.length === 0) {
        return 'Your cart is currently empty.'
    }

    let cartMessage = 'Your cart contains the following items:\n\n'
    let totalPrice = 0

    cartItems.forEach((item, index) => {
        cartMessage += `${index + 1}. ${item.name} - ${item.quantity} - ${
            item.price
        } ₽\n`
        totalPrice += item.price
    })

    cartMessage += `\nTotal: ${totalPrice} ₽`
    return cartMessage
}

export async function checkAndHandleCartStatus(
    bot: BrowserBot,
    ctx: Context
): Promise<void> {
    if (!bot.page) {
        await ctx.reply('Browser page not available')
        return
    }

    try {
        // Check cart status
        const cartHasItems = await checkCartStatus(bot.page)

        if (cartHasItems) {
            // Parse cart items and store them in the private variable
            bot.cartItems = await parseCartItems(bot.page)

            // Send the formatted message to the user
            await ctx.reply(formatCartMessage(bot.cartItems))

            // Create inline keyboard with two buttons
            const keyboard = new InlineKeyboard()
                .text('Clean cart', 'clean_cart')
                .text('Continue with items', 'continue_with_cart')

            await ctx.reply(
                'Your cart is not empty. Do you want to clean it or continue with existing items?',
                { reply_markup: keyboard }
            )
        } else {
            // Clear cart items array if the cart is empty
            bot.cartItems = []
            await ctx.reply('Cart is empty. Ready to process orders.')
        }
    } catch (error) {
        console.error('Error checking cart status:', error)
        await ctx.reply('Failed to check cart status')
    }
}
