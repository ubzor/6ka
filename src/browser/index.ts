// Core browser functionality
export { initializeBrowser, initializePage } from './core'

// Authentication functions
export {
    isUserLoggedIn,
    login,
    inputVerificationCode,
    saveAuthState
} from './authentication'

// Cart functions
export { checkCartStatus, cleanCart, parseCartItems } from './cart'

// Utility functions
export { takeScreenshot, handleError } from './utils'
