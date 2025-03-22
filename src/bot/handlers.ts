import { Context, InlineKeyboard } from 'grammy'
import { BotState } from '../types'
import {
    handleNewOrderCommand,
    handleCloseCommand,
    handleCartItemsCommand
} from './commands'
import {
    processVerificationCode,
    processLlmRequest,
    checkAndHandleCartStatus
} from './utils'
import { cleanCart } from '../browser'

export function setupHandlers(bot: any) {
    // Replace the generic text message handler with a specific command handler
    bot.bot.command('neworder', (ctx: Context) => {
        bot.enqueueTask(
            () => handleNewOrderCommand(bot, ctx),
            'Processing new order',
            ctx
        )
    })

    // Add a command to close the browser explicitly
    bot.bot.command('close', (ctx: Context) => {
        bot.enqueueTask(
            () => handleCloseCommand(bot, ctx),
            'Closing browser session',
            ctx
        )
    })

    // Add a command to display current cart items
    bot.bot.command('cartitems', (ctx: Context) => {
        bot.enqueueTask(
            () => handleCartItemsCommand(bot, ctx),
            'Checking cart',
            ctx
        )
    })

    // Add a handler for text messages (for verification code input)
    bot.bot.on('message:text', (ctx: Context) => {
        bot.enqueueTask(
            () => handleTextMessageTask(bot, ctx),
            'Processing text message',
            ctx
        )
    })

    // Add callback handlers for cart cleaning buttons
    bot.bot.callbackQuery('clean_cart', (ctx: Context) => {
        bot.enqueueTask(() => handleCleanCart(bot, ctx), 'Cleaning cart', ctx)
    })

    bot.bot.callbackQuery('continue_with_cart', (ctx: Context) => {
        bot.enqueueTask(
            () => handleContinueWithCart(bot, ctx),
            'Continuing with current items',
            ctx
        )
    })

    // Add status command to check bot state and queue
    bot.bot.command('status', (ctx: Context) => {
        const stateMessage =
            `Current state: ${bot.state}\n` +
            `Tasks in queue: ${bot.getQueueStatus().length}\n`
        ctx.reply(stateMessage)
    })
}

export async function handleCleanCart(bot: any, ctx: Context): Promise<void> {
    if (!bot.page || bot.state !== BotState.ACTIVE) {
        await ctx.answerCallbackQuery({
            text: 'Browser session not active',
            show_alert: true
        })
        return
    }

    await ctx.answerCallbackQuery()
    await ctx.reply('Cleaning your cart...')

    const success = await cleanCart(bot.page)

    if (success) {
        // Clear the cart items array when the cart is successfully cleaned
        bot.cartItems = []
        await ctx.reply(
            'Cart has been cleaned successfully. You can now proceed with your order.'
        )
    } else {
        await ctx.reply(
            'Failed to clean cart. Please try again or continue with items in cart.'
        )
    }
}

export async function handleContinueWithCart(
    bot: any,
    ctx: Context
): Promise<void> {
    await ctx.answerCallbackQuery()
    await ctx.reply('Continuing with items in cart.')
    // Add any additional logic needed when continuing with items in cart
}

export async function handleTextMessageTask(
    bot: any,
    ctx: Context
): Promise<void> {
    const text = ctx.message?.text

    if (!text) return

    // Process verification code if we're in the right state
    if (bot.state === BotState.AWAITING_CODE && text && bot.page) {
        await processVerificationCode(bot, ctx, text)
    }
    // If bot is in ACTIVE state, send the text to LLM
    else if (bot.state === BotState.ACTIVE) {
        await processLlmRequest(bot, ctx, text)
    }
    // Additional text message handling can be added here in the future
}
