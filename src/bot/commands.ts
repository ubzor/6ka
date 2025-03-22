import { Context } from 'grammy'
import { BotState } from '../types'
import {
    isUserLoggedIn,
    initializeBrowser,
    initializePage,
    login,
    checkCartStatus,
    parseCartItems
} from '../browser'
import { checkAndHandleCartStatus, formatCartMessage } from './utils'

export async function handleNewOrderCommand(
    bot: any,
    ctx: Context
): Promise<void> {
    try {
        await ctx.reply('Processing new order request...')
        bot.state = BotState.INITIALIZING

        // Ensure browser is initialized and logged in
        await ensureBrowserLoggedIn(bot, ctx)
    } catch (error) {
        console.error('Error during order processing:', error)
        await ctx.reply(
            'Sorry, I encountered an error while processing your order request.'
        )
        bot.state = BotState.INACTIVE
    }
}

export async function ensureBrowserLoggedIn(
    bot: any,
    ctx: Context
): Promise<void> {
    // Initialize browser if it doesn't exist
    if (!bot.browser) {
        await ctx.reply('Starting browser session...')
        try {
            bot.browser = await initializeBrowser()
        } catch (error) {
            console.error('Error initializing browser:', error)
            await ctx.reply(
                'Failed to initialize browser: could not start browser session'
            )
            bot.state = BotState.INACTIVE
            return
        }
    }

    // Initialize page if it doesn't exist or is closed
    if (!bot.page || bot.page.isClosed()) {
        await ctx.reply('Initializing browser page...')
        try {
            bot.page = await initializePage(bot.browser)
        } catch (error) {
            console.error('Error initializing page:', error)
            await ctx.reply('Failed to initialize browser page')
            bot.state = BotState.INACTIVE
            return
        }
    }

    // Check login status
    const loggedIn = await isUserLoggedIn(bot.page)

    if (loggedIn) {
        await ctx.reply('Using existing logged-in browser session')
        bot.state = BotState.ACTIVE

        // Check cart status when user is already logged in
        await checkAndHandleCartStatus(bot, ctx)
    } else {
        await ctx.reply('Not logged in. Navigating to login page...')
        await login(bot.page)
        await ctx.reply(
            'Successfully navigated to login page and entered phone. Please enter the verification code (4 digits).'
        )

        // Update the state to await verification code
        bot.state = BotState.AWAITING_CODE
    }
}

export async function handleCloseCommand(
    bot: any,
    ctx: Context
): Promise<void> {
    if (bot.browser) {
        await bot.browser.close()
        bot.browser = null
        bot.page = null
        bot.state = BotState.INACTIVE
        await ctx.reply('Browser session closed')
    } else {
        await ctx.reply('No active browser session')
    }
}

export async function handleCartItemsCommand(
    bot: any,
    ctx: Context
): Promise<void> {
    try {
        await ctx.reply('Checking your shopping cart...')

        // Check if browser and page are initialized
        if (!bot.browser || !bot.page || bot.state !== BotState.ACTIVE) {
            await ctx.reply(
                'Browser session is not active. Please use /neworder first.'
            )
            return
        }

        // Check if the user is logged in
        const loggedIn = await isUserLoggedIn(bot.page)
        if (!loggedIn) {
            await ctx.reply(
                'You need to be logged in to view cart items. Please use /neworder first.'
            )
            bot.state = BotState.INACTIVE
            return
        }

        // Check cart status and update the cart items
        const cartHasItems = await checkCartStatus(bot.page)

        if (!cartHasItems) {
            // Clear cart items array if the cart is empty
            bot.cartItems = []
            await ctx.reply('Your cart is currently empty.')
            return
        }

        // Update the cart items in our private variable
        bot.cartItems = await parseCartItems(bot.page)

        // Display the cart items using our helper method
        await ctx.reply(formatCartMessage(bot.cartItems))
    } catch (error) {
        console.error('Error checking cart items:', error)
        await ctx.reply('An error occurred while checking your cart items.')
    }
}
