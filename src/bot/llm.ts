import { FileLoader } from '../utils/FileLoader'

/**
 * Makes an API call to the LLM endpoint
 * @param userText The user's text to send to the LLM
 * @param systemPrompt The system prompt to provide context to the LLM (currently unused)
 * @returns The response from the LLM
 */
export async function callLlmApi(
    userText: string,
    systemPrompt: string // kept for backward compatibility
): Promise<string> {
    try {
        // Load prompt directly from file instead of using the passed systemPrompt
        const promptFromFile = FileLoader.loadLlmPrompt()

        // Replace placeholders in the prompt with actual values
        let fullPrompt = promptFromFile.replace('{{user_input}}', userText)

        const response = await fetch('http://0.0.0.0:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gemma3:1b-it-fp16',
                prompt: fullPrompt,
                stream: false
            })
        })

        if (!response.ok) {
            throw new Error(`LLM API responded with status: ${response.status}`)
        }

        const data = await response.json()

        // Extract the response text from the API response
        if (data && data.response) {
            // Clean the response to handle markdown code blocks
            return cleanLlmResponse(data.response)
        } else {
            throw new Error('Invalid response format from LLM API')
        }
    } catch (error) {
        console.error('Error calling LLM API:', error)
        throw new Error('Failed to get response from LLM API')
    }
}

/**
 * Cleans the LLM response by extracting JSON content from markdown code blocks if present
 * @param response The raw response from the LLM
 * @returns Cleaned response with just the JSON content
 */
function cleanLlmResponse(response: string): string {
    // Check if response contains markdown code blocks
    const jsonBlockRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/m
    const match = response.match(jsonBlockRegex)

    if (match && match[1]) {
        // Return just the JSON content within the code block
        return match[1].trim()
    }

    // If no code blocks found, return the original response
    // This allows handling both raw JSON and markdown-formatted responses
    return response.trim()
}
