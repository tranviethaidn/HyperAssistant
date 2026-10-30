export const DEFAULT_SETTINGS = {
    apiProvider: 'gemini',            // API provider: 'gemini' or 'groq'
    apiKey: '',                       // User needs to provide this (Gemini API key)
    groqApiKey: '',                   // Groq API key
    modelName: 'gemini-2.5-flash-lite',    // Default Gemini model
    groqModelName: 'llama-3.3-70b-versatile', // Default Groq model
    customModel: '',                  // Custom model (if provided)
    geminiMode: 'api',                // Gemini mode for Model Settings: 'api' or 'live'
    liveModelId: 'gemini-3.1-flash-live-preview', // Default Live API model id (without models/ prefix)
    temperature: null,                // Default generation parameters (null means use API default)
    topK: null,
    topP: null,
    maxOutputTokens: null,
    safetySettings: [],                // Default safety settings (empty means use API default)
    defaultTargetLanguage: 'vietnamese',   // Default target language for text translate
    emotionStyle: 'conversation',      // Default emotion style
    uiLanguage: 'en'                   // Default UI language
};
