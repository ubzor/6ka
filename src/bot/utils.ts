import { Context, InlineKeyboard } from 'grammy'
import { BotState, CartItem } from '../types'
import {
    isUserLoggedIn,
    inputVerificationCode,
    checkCartStatus,
    parseCartItems
} from '../browser'
import { callLlmApi } from './llm'

export async function processVerificationCode(
    bot: any,
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
    bot: any,
    ctx: Context,
    text: string
): Promise<void> {
    try {
        await ctx.reply('Processing your request with AI...')

        // Get the AI response with the combined prompt and user text
        const response = await callLlmApi(text, bot.llmPrompt)

        try {
            // Try to parse the response as JSON
            const parsedResponse = JSON.parse(response)

            // Send the parsed response in a more readable format
            let replyMessage = "Here's what I understood:\n\n"

            // Format the "add" items
            if (parsedResponse.add && parsedResponse.add.length > 0) {
                replyMessage += '✅ Adding to cart:\n'
                parsedResponse.add.forEach((item: any) => {
                    if (item.count === 'MIN') {
                        replyMessage += `• ${item.name}\n`
                    } else {
                        replyMessage += `• ${item.name}: ${item.count} ${
                            item.unit || ''
                        }\n`
                    }
                })
                replyMessage += '\n'
            }

            // Format the "remove" items
            if (parsedResponse.remove && parsedResponse.remove.length > 0) {
                replyMessage += '❌ Removing from cart:\n'
                parsedResponse.remove.forEach((item: any) => {
                    if (item.count === 'ALL') {
                        replyMessage += `• All ${item.name}\n`
                    } else {
                        replyMessage += `• ${item.name}: ${item.count} ${
                            item.unit || ''
                        }\n`
                    }
                })
                replyMessage += '\n'
            }

            // Format the "set" items
            if (parsedResponse.set && parsedResponse.set.length > 0) {
                replyMessage += '⚖️ Setting quantity:\n'
                parsedResponse.set.forEach((item: any) => {
                    replyMessage += `• ${item.name}: ${item.count} ${
                        item.unit || ''
                    }\n`
                })
            }

            await ctx.reply(replyMessage)
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
    bot: any,
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
