/**
 * Makes an API call to the LLM endpoint
 * @param userText The user's text to send to the LLM
 * @param systemPrompt The system prompt to provide context to the LLM
 * @returns The response from the LLM
 */
export async function callLlmApi(
    userText: string,
    systemPrompt: string
): Promise<string> {
    try {
        // Combine the system prompt with the user's text
        const fullPrompt = `${systemPrompt}\n${userText}`

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
            return data.response
        } else {
            throw new Error('Invalid response format from LLM API')
        }
    } catch (error) {
        console.error('Error calling LLM API:', error)
        throw new Error('Failed to get response from LLM API')
    }
}
