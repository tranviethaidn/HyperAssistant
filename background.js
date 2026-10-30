// background.js - v13 (Streaming Support, Groq Integration)

// Import prompts and translations
import { PROMPT_TEXT_TRANSLATE, PROMPT_FAST_TRANSLATE, PROMPT_IMAGE_TRANSLATE, PROMPT_PAGE_BATCH_TRANSLATE, PROMPT_SUMMARIZE_SELECTED_TEXT } from './promptconfig.js';
import { uiTranslations } from './ui_translations.js';
import { DEFAULT_SETTINGS } from './constants.js';

let currentSettings = { ...DEFAULT_SETTINGS }; // Holds the currently loaded settings
const LOG_PREFIX = "[HyperAssistantBG]"; // Logging prefix

// --- Promise to ensure settings are loaded before processing messages --- 
let settingsReadyPromise = null;

// --- Function to Load Settings from chrome.storage.sync ---
function loadSettings() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['settings'], (result) => {
            if (chrome.runtime.lastError) {
                resolve({ ...DEFAULT_SETTINGS });
                return;
            }

            const loadedSettings = result.settings || {};
            const finalSettings = {};

            // Safely merge loaded settings with defaults
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                finalSettings[key] = loadedSettings.hasOwnProperty(key)
                    ? loadedSettings[key]
                    : DEFAULT_SETTINGS[key];
            });

            currentSettings = finalSettings;
            resolve(finalSettings);
        });
    });
}

// --- Listen for Changes in Storage ---
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.settings) {
        settingsReadyPromise = loadSettings();
        settingsReadyPromise.then(updatedSettings => {
            if (changes.settings.newValue?.uiLanguage !== changes.settings.oldValue?.uiLanguage) {
                updateContextMenus(updatedSettings.uiLanguage);
            }
        });
    }
});

// Function to create context menus with proper translations
function updateContextMenus(uiLanguage = 'en') {
    chrome.contextMenus.removeAll(() => {
        const translations = uiTranslations[uiLanguage] || uiTranslations['en'];

        // Setup context menu for options
        chrome.contextMenus.create({
            id: "hypertranslator-options",
            title: "HyperAssistant Options",
            contexts: ["action"]
        });

        // Setup context menu for image translate
        chrome.contextMenus.create({
            id: "hypertranslator-image-translate",
            title: translations.imageTranslateMenuItem || "Image Translate",
            contexts: ["image"]
        });

        // Setup context menu for full page translate
        chrome.contextMenus.create({
            id: "hypertranslator-full-page-translate",
            title: "Translate Full Page",
            contexts: ["page", "selection", "link"]
        });
    });
}

// --- Extension Installation/Update Handler ---
chrome.runtime.onInstalled.addListener((details) => {
    settingsReadyPromise = loadSettings().then(settings => {
        updateContextMenus(settings.uiLanguage);
        return settings;
    });

    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
            .catch((error) => { /* console.error(LOG_PREFIX, 'Error setting side panel behavior:', error); */ });
    }
});

// --- Listener for Context Menu Click ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "hypertranslator-options") {
        chrome.runtime.openOptionsPage();
    } else if (info.menuItemId === "hypertranslator-image-translate") {
        chrome.tabs.sendMessage(tab.id, {
            action: "initiateImageTranslate",
            imageUrl: info.srcUrl
        });
    } else if (info.menuItemId === "hypertranslator-full-page-translate") {
        chrome.tabs.sendMessage(tab.id, {
            action: "initiateFullPageTranslate"
        });
    }
});


// --- Function to Call the Gemini API (Streaming) ---
function normalizeGeminiModelId(modelId) {
    return String(modelId || '').trim().replace(/^models\//i, '');
}

// In-Memory LRU Cache for fast interactive translations
const translationCache = new Map();
const MAX_CACHE_SIZE = 150;

function getCachedTranslation(key) {
    if (translationCache.has(key)) {
        const val = translationCache.get(key);
        translationCache.delete(key);
        translationCache.set(key, val);
        return val;
    }
    return null;
}

function setCachedTranslation(key, val) {
    if (translationCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = translationCache.keys().next().value;
        translationCache.delete(oldestKey);
    }
    translationCache.set(key, val);
}

function safePostMessage(port, message) {
    try {
        port.postMessage(message);
    } catch (_) {
        // Port disconnected
    }
}

function buildPrompt(textToTranslate, promptTemplate, targetLanguage = null, settings) {
    let prompt = '';

    if (promptTemplate === PROMPT_TEXT_TRANSLATE) {
        prompt = PROMPT_TEXT_TRANSLATE
            .replace('[text_translate_target_language]', () => settings.defaultTargetLanguage || 'english')
            .replace('[emotion]', () => settings.emotionStyle || 'serious')
            .replace('[inputText]', () => textToTranslate);
    } else if (promptTemplate === PROMPT_FAST_TRANSLATE) {
        prompt = PROMPT_FAST_TRANSLATE
            .replace('[target_language]', () => targetLanguage || 'english')
            .replace('[inputText]', () => textToTranslate);
    } else if (promptTemplate === PROMPT_SUMMARIZE_SELECTED_TEXT) {
        prompt = PROMPT_SUMMARIZE_SELECTED_TEXT
            .replace('[text_translate_target_language]', () => settings.defaultTargetLanguage || 'english')
            .replace('[inputText]', () => textToTranslate);
    } else if (promptTemplate === PROMPT_IMAGE_TRANSLATE) {
        prompt = PROMPT_IMAGE_TRANSLATE
            .replace('[text_translate_target_language]', () => settings.defaultTargetLanguage || 'english')
            .replace('[emotion]', () => settings.emotionStyle || 'serious')
            .replace('[ImageURL]', () => textToTranslate);
    } else if (promptTemplate === PROMPT_PAGE_BATCH_TRANSLATE) {
        prompt = PROMPT_PAGE_BATCH_TRANSLATE
            .replace('[target_language]', () => targetLanguage || 'english')
            .replace('[inputJSON]', () => textToTranslate);
    }

    return prompt;
}

async function streamGeminiLiveAPI(textToTranslate, promptTemplate, targetLanguage = null, settings, port) {
    if (!settings || !settings.apiKey) {
        port.postMessage({ action: "error", error: "API Key not configured in Options." });
        return;
    }
    if (!textToTranslate) {
        port.postMessage({ action: "error", error: "No text provided." });
        return;
    }

    const liveModelId = normalizeGeminiModelId(settings.liveModelId || DEFAULT_SETTINGS.liveModelId || '');
    if (!liveModelId) {
        port.postMessage({ action: "error", error: "Live API model ID not configured in Options." });
        return;
    }

    const prompt = buildPrompt(textToTranslate, promptTemplate, targetLanguage, settings);
    if (!prompt) {
        port.postMessage({ action: "error", error: "Unable to build prompt." });
        return;
    }

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(settings.apiKey)}`;
    const modelResource = `models/${liveModelId}`;

    const generationConfig = {
        responseModalities: ['AUDIO']
    };
    if (settings.temperature != null) generationConfig.temperature = settings.temperature;
    if (settings.topK != null) generationConfig.topK = settings.topK;
    if (settings.topP != null) generationConfig.topP = settings.topP;
    if (settings.maxOutputTokens != null) generationConfig.maxOutputTokens = settings.maxOutputTokens;

    let socket = null;
    let finished = false;
    let opened = false;
    let setupCompleteSeen = false;
    let sentTurn = false;
    let lastTranscript = '';
    let finishSoonHandle = null;

    let connectTimeoutHandle = null;
    let setupCompleteTimeoutHandle = null;
    let responseTimeoutHandle = null;

    function cleanupTimers() {
        if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
        if (setupCompleteTimeoutHandle) clearTimeout(setupCompleteTimeoutHandle);
        if (responseTimeoutHandle) clearTimeout(responseTimeoutHandle);
        if (finishSoonHandle) clearTimeout(finishSoonHandle);
        connectTimeoutHandle = null;
        setupCompleteTimeoutHandle = null;
        responseTimeoutHandle = null;
        finishSoonHandle = null;
    }

    function finishOk() {
        if (finished) return;
        finished = true;
        cleanupTimers();
        try {
            if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        } catch (_) {
            // ignore
        }
        port.postMessage({ action: 'done' });
    }

    function finishError(errorMessage) {
        if (finished) return;
        finished = true;
        cleanupTimers();
        try {
            if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        } catch (_) {
            // ignore
        }
        port.postMessage({ action: 'error', error: errorMessage || 'Live API error.' });
    }

    function sendTurn() {
        if (finished || !socket || socket.readyState !== WebSocket.OPEN) return;
        if (!setupCompleteSeen || sentTurn) return;

        const turnMessage = {
            clientContent: {
                turns: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                turnComplete: true
            }
        };

        try {
            socket.send(JSON.stringify(turnMessage));
            sentTurn = true;
        } catch (_) {
            // ignore
        }

        // Start response timeout after we have sent a turn.
        if (responseTimeoutHandle) clearTimeout(responseTimeoutHandle);
        responseTimeoutHandle = setTimeout(() => {
            finishError('Timed out waiting for Live API output.');
        }, 20000);
    }

    function appendTranscriptChunk(newText) {
        const text = String(newText || '');
        if (!text) return;

        // If we're about to finish, receiving more output means we should wait a bit longer.
        if (finishSoonHandle) {
            clearTimeout(finishSoonHandle);
            finishSoonHandle = setTimeout(() => finishOk(), 500);
        }

        // De-dup: if server sends cumulative transcription, stream only the delta.
        if (text.startsWith(lastTranscript)) {
            const delta = text.slice(lastTranscript.length);
            lastTranscript = text;
            if (delta) port.postMessage({ action: 'chunk', text: delta });
            return;
        }

        // If it's not cumulative, just stream the chunk as-is.
        lastTranscript += text;
        port.postMessage({ action: 'chunk', text: text });
    }

    // Cancel the WebSocket if the UI disconnects.
    port.onDisconnect.addListener(() => {
        if (finished) return;
        finished = true;
        cleanupTimers();
        try {
            if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        } catch (_) {
            // ignore
        }
    });

    const connectTimeoutMs = 8000;
    const setupCompleteTimeoutMs = 12000;

    connectTimeoutHandle = setTimeout(() => {
        if (!opened) finishError('Unable to open WebSocket connection.');
    }, connectTimeoutMs);

    try {
        socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';

        socket.addEventListener('open', () => {
            opened = true;
            if (connectTimeoutHandle) {
                clearTimeout(connectTimeoutHandle);
                connectTimeoutHandle = null;
            }

            const setupMessage = {
                setup: {
                    model: modelResource,
                    generationConfig,
                    systemInstruction: {
                        parts: [{ text: 'Follow the user request carefully. Output only the final answer.' }]
                    },
                    // Enables outputTranscription in serverContent.
                    outputAudioTranscription: {}
                }
            };

            try {
                socket.send(JSON.stringify(setupMessage));
            } catch (_) {
                // ignore
            }

            if (setupCompleteTimeoutHandle) clearTimeout(setupCompleteTimeoutHandle);
            setupCompleteTimeoutHandle = setTimeout(() => {
                if (!setupCompleteSeen) finishError('Timed out waiting for Live API setupComplete.');
            }, setupCompleteTimeoutMs);
        });

        socket.addEventListener('message', async (event) => {
            if (finished) return;

            let payloadText = '';
            try {
                if (typeof event.data === 'string') {
                    payloadText = event.data;
                } else if (event.data instanceof ArrayBuffer) {
                    payloadText = new TextDecoder('utf-8').decode(event.data);
                } else if (event.data instanceof Blob) {
                    payloadText = await event.data.text();
                } else if (ArrayBuffer.isView(event.data)) {
                    payloadText = new TextDecoder('utf-8').decode(event.data.buffer);
                } else {
                    return;
                }
            } catch (_) {
                return;
            }

            let msg;
            try {
                msg = JSON.parse(payloadText);
            } catch (_) {
                return;
            }

            if (msg?.error) {
                const message = msg?.error?.message || msg?.error?.status || 'Live API error.';
                finishError(String(message));
                return;
            }

            if (msg.setupComplete) {
                setupCompleteSeen = true;
                if (setupCompleteTimeoutHandle) {
                    clearTimeout(setupCompleteTimeoutHandle);
                    setupCompleteTimeoutHandle = null;
                }
                sendTurn();
                return;
            }

            if (msg.serverContent) {
                const serverContent = msg.serverContent;

                // Stream transcription if present.
                const transcriptionText = (serverContent?.outputTranscription?.text || '').trim();
                if (transcriptionText) {
                    appendTranscriptChunk(transcriptionText);
                }

                // Some models may emit text parts.
                const parts = serverContent?.modelTurn?.parts || [];
                const partText = parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
                if (partText) {
                    appendTranscriptChunk(partText);
                }

                // Finish when turnComplete is signaled.
                if (serverContent?.turnComplete === true) {
                    if (finishSoonHandle) clearTimeout(finishSoonHandle);
                    finishSoonHandle = setTimeout(() => finishOk(), 500);
                }
            }

            if (msg.goAway) {
                finishError('Server requested disconnect (goAway).');
            }
        });

        socket.addEventListener('error', () => {
            if (finished) return;
            // Often followed by close with code; keep message simple.
            finishError('WebSocket error.');
        });

        socket.addEventListener('close', (event) => {
            if (finished) return;
            const code = typeof event?.code === 'number' ? event.code : null;
            const reason = String(event?.reason || '').trim();
            const details = code != null ? ` (${code}${reason ? ` - ${reason}` : ''})` : (reason ? ` (${reason})` : '');
            finishError(`WebSocket closed.${details}`);
        });
    } catch (e) {
        finishError(e?.message || String(e));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createSemaphore(maxConcurrent) {
    let activeCount = 0;
    const waiters = [];

    function releaseFactory() {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            activeCount = Math.max(0, activeCount - 1);
            const next = waiters.shift();
            if (next) next();
        };
    }

    return {
        acquire() {
            if (activeCount < maxConcurrent) {
                activeCount += 1;
                return Promise.resolve(releaseFactory());
            }
            return new Promise(resolve => {
                waiters.push(() => {
                    activeCount += 1;
                    resolve(releaseFactory());
                });
            });
        }
    };
}

const geminiBatchSemaphore = createSemaphore(3);

function isRetryableGeminiStatus(status) {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterMs(retryAfterValue) {
    if (!retryAfterValue) return null;
    const trimmed = String(retryAfterValue).trim();
    if (!trimmed) return null;

    // Retry-After can be seconds or an HTTP date.
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(60_000, Math.round(seconds * 1000));
    }

    const dateMs = Date.parse(trimmed);
    if (!Number.isNaN(dateMs)) {
        const delta = dateMs - Date.now();
        if (delta > 0) return Math.min(60_000, delta);
    }
    return null;
}

function extractGeminiErrorMessage(responseText) {
    let errorMsg = '';
    try {
        const errorData = JSON.parse(responseText);
        if (errorData?.error?.message) errorMsg = String(errorData.error.message);
        else if (errorData?.message) errorMsg = String(errorData.message);
    } catch (_) {
        // If not JSON, it might be an HTML error page from a proxy/VPN.
        if (typeof responseText === 'string' && (responseText.includes('Cloudflare') || responseText.includes('cuttlefish'))) {
            errorMsg = 'Request blocked by VPN/Proxy provider (Cloudflare).';
        }
    }
    return errorMsg;
}

async function fetchGeminiStreamWithRetry(apiUrl, requestBody, maxAttempts = 3, signal = null) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (signal?.aborted) throw new Error('Aborted');
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: signal
            });

            if (response.ok) return response;

            const responseText = await response.text();
            const parsedMessage = extractGeminiErrorMessage(responseText);
            const status = response.status;

            lastError = { status, message: parsedMessage || `API Error ${status}` };

            const shouldRetry = isRetryableGeminiStatus(status) && attempt < maxAttempts;
            if (!shouldRetry) break;

            const retryAfterMs = parseRetryAfterMs(response.headers?.get?.('retry-after'));
            const baseDelay = 800;
            const exponentialMs = Math.min(10_000, baseDelay * Math.pow(2, attempt - 1));
            const delayMs = retryAfterMs != null ? Math.max(exponentialMs, retryAfterMs) : exponentialMs;
            const jitterMs = Math.floor(Math.random() * Math.min(500, Math.floor(delayMs * 0.25)));
            await sleep(delayMs + jitterMs);
        } catch (e) {
            lastError = { status: null, message: e?.message || String(e) };
            if (attempt >= maxAttempts) break;

            const baseDelay = 800;
            const delayMs = Math.min(10_000, baseDelay * Math.pow(2, attempt - 1));
            const jitterMs = Math.floor(Math.random() * Math.min(500, Math.floor(delayMs * 0.25)));
            await sleep(delayMs + jitterMs);
        }
    }

    const err = new Error(lastError?.message || 'Request failed');
    err.status = lastError?.status ?? null;
    throw err;
}

async function streamGeminiAPI(textToTranslate, promptTemplate, targetLanguage = null, settings, port, isBatch = false) {
    if (!settings || !settings.apiKey) {
        safePostMessage(port, { action: "error", error: "API Key not configured in Options." });
        return;
    }
    if (!textToTranslate) {
        safePostMessage(port, { action: "error", error: "No text provided." });
        return;
    }

    // Check in-memory cache for interactive translations
    const isInteractive = promptTemplate === PROMPT_TEXT_TRANSLATE || promptTemplate === PROMPT_FAST_TRANSLATE;
    const cacheKey = `${promptTemplate}_${targetLanguage || settings.defaultTargetLanguage || ''}_${textToTranslate}`;
    if (isInteractive) {
        const cached = getCachedTranslation(cacheKey);
        if (cached) {
            safePostMessage(port, { action: "chunk", text: cached });
            safePostMessage(port, { action: "done" });
            return;
        }
    }

    // Prepare the prompt
    const prompt = buildPrompt(textToTranslate, promptTemplate, targetLanguage, settings);

    const modelToUseRaw = (settings.customModel || '').trim() || settings.modelName;
    const modelToUse = normalizeGeminiModelId(modelToUseRaw);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToUse)}:streamGenerateContent?key=${encodeURIComponent(settings.apiKey)}`;

    const generationConfig = {};
    if (settings.temperature != null) generationConfig.temperature = settings.temperature;
    if (settings.topK != null) generationConfig.topK = settings.topK;
    if (settings.topP != null) generationConfig.topP = settings.topP;
    if (settings.maxOutputTokens != null) generationConfig.maxOutputTokens = settings.maxOutputTokens;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: settings.safetySettings || [],
        generationConfig: generationConfig
    };

    if (promptTemplate === PROMPT_IMAGE_TRANSLATE) {
        try {
            const imageInfo = await getBase64FromImageUrl(textToTranslate);
            requestBody.contents[0].parts = [
                { text: prompt },
                { inline_data: { mime_type: imageInfo.mimeType, data: imageInfo.base64 } }
            ];
        } catch (e) {
            safePostMessage(port, { action: "error", error: "Failed to process image." });
            return;
        }
    }

    const abortController = new AbortController();
    const disconnectHandler = () => abortController.abort();
    port.onDisconnect.addListener(disconnectHandler);

    let releaseLock = null;
    if (isBatch) {
        releaseLock = await geminiBatchSemaphore.acquire();
    }

    let accumulatedText = "";

    try {
        const response = await fetchGeminiStreamWithRetry(apiUrl, requestBody, 3, abortController.signal);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const { remainingBuffer, objects } = extractJSONObjects(buffer);
            buffer = remainingBuffer;

            for (const chunkData of objects) {
                try {
                    const text = chunkData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        accumulatedText += text;
                        safePostMessage(port, { action: "chunk", text: text });
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        if (isInteractive && accumulatedText) {
            setCachedTranslation(cacheKey, accumulatedText);
        }

        safePostMessage(port, { action: "done" });
    } catch (error) {
        if (abortController.signal.aborted) return; // User closed tab/box, no error needed

        const status = error?.status;
        let message = String(error?.message || error);
        const lower = message.toLowerCase();

        if (status === 400 && lower.includes('api key')) message = 'Invalid API Key.';
        if (status === 400 && lower.includes('location')) message = 'Gemini API is not supported in your current VPN region.';
        if (status === 429) message = 'Too many requests. Please try again in a few seconds.';
        if (status === 503) message = 'Gemini service is temporarily unavailable or overloaded (503). Please try again in a few seconds.';

        safePostMessage(port, { action: "error", error: message });
    } finally {
        if (releaseLock) releaseLock();
        try { port.onDisconnect.removeListener(disconnectHandler); } catch (_) {}
    }
}

// --- Function to Call the Groq API (Streaming) ---
async function streamGroqAPI(textToTranslate, promptTemplate, targetLanguage = null, settings, port) {
    if (!settings || !settings.groqApiKey) {
        safePostMessage(port, { action: "error", error: "Groq API Key not configured in Options." });
        return;
    }
    if (!textToTranslate) {
        safePostMessage(port, { action: "error", error: "No text provided." });
        return;
    }

    const prompt = buildPrompt(textToTranslate, promptTemplate, targetLanguage, settings);

    if (promptTemplate === PROMPT_IMAGE_TRANSLATE) {
        safePostMessage(port, { action: "error", error: "Groq API does not support image translation. Please switch to Gemini." });
        return;
    }

    const modelToUse = settings.groqModelName || 'llama-3.3-70b-versatile';
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const requestBody = {
        model: modelToUse,
        messages: [{ role: "user", content: prompt }],
        stream: true
    };

    if (settings.groqTemperature != null) requestBody.temperature = settings.groqTemperature;
    if (settings.groqMaxTokens != null) requestBody.max_tokens = settings.groqMaxTokens;

    const abortController = new AbortController();
    const disconnectHandler = () => abortController.abort();
    port.onDisconnect.addListener(disconnectHandler);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.groqApiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        if (!response.ok) {
            const responseText = await response.text();
            let errorMsg = `API Error ${response.status}`;
            try {
                const errorData = JSON.parse(responseText).error;
                if (errorData && errorData.message) errorMsg = errorData.message;
            } catch (e) { 
                if (responseText.includes("Cloudflare")) {
                    errorMsg = "Request blocked by Cloudflare (VPN issue).";
                }
            }

            if (response.status === 401) errorMsg = "Invalid Groq API Key.";

            safePostMessage(port, { action: "error", error: errorMsg });
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.choices?.[0]?.delta?.content;
                        if (text) {
                            safePostMessage(port, { action: "chunk", text: text });
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        safePostMessage(port, { action: "done" });
    } catch (error) {
        if (abortController.signal.aborted) return;
        safePostMessage(port, { action: "error", error: error.message });
    } finally {
        try { port.onDisconnect.removeListener(disconnectHandler); } catch (_) {}
    }
}

// --- Unified Stream Function (chooses between Gemini and Groq) ---
async function streamTranslateAPI(textToTranslate, promptTemplate, targetLanguage = null, settings, port) {
    const provider = settings.apiProvider || 'gemini';

    if (provider === 'groq') {
        await streamGroqAPI(textToTranslate, promptTemplate, targetLanguage, settings, port);
    } else {
        const geminiMode = settings.geminiMode || 'api';

        // Live API is currently applied only to text-based translations.
        // - Image translation uses the regular Gemini API (needs image parts)
        // - Full-page batch translation expects strict JSON output (audio transcription can break it)
        const liveEligible = geminiMode === 'live'
            && promptTemplate !== PROMPT_IMAGE_TRANSLATE
            && promptTemplate !== PROMPT_PAGE_BATCH_TRANSLATE;

        if (liveEligible) {
            await streamGeminiLiveAPI(textToTranslate, promptTemplate, targetLanguage, settings, port);
        } else {
            await streamGeminiAPI(textToTranslate, promptTemplate, targetLanguage, settings, port);
        }
    }
}

// Helper function to convert image URL to base64
async function getBase64FromImageUrl(url) {
    if (url.startsWith('data:')) {
        const [header, data] = url.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        return { base64: data, mimeType: mime };
    }
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    return { base64, mimeType };
}

// --- Connection Listener (Streaming) ---
chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener(async (message) => {
        if (!settingsReadyPromise) settingsReadyPromise = loadSettings();
        let resolvedSettings = await settingsReadyPromise;

        if (message.action === "translateInputText") {
            const targetLanguage = (message.targetLanguage || 'english').toLowerCase();
            streamTranslateAPI(message.text, PROMPT_FAST_TRANSLATE, targetLanguage, resolvedSettings, port);
        } else if (message.action === "translateSelectedText") {
            streamTranslateAPI(message.text, PROMPT_TEXT_TRANSLATE, null, resolvedSettings, port);
        } else if (message.action === "summarizeSelectedText") {
            streamTranslateAPI(message.text, PROMPT_SUMMARIZE_SELECTED_TEXT, null, resolvedSettings, port);
        } else if (message.action === "translateImage") {
            // Image translation always uses Gemini
            streamGeminiAPI(message.imageUrl, PROMPT_IMAGE_TRANSLATE, null, resolvedSettings, port);
        } else if (message.action === "translatePageBatch") {
            // Using JSON.stringify to safely format the object as string for the prompt
            const inputJSON = JSON.stringify(message.batchData);
            const targetLanguage = (message.targetLanguage || resolvedSettings.defaultTargetLanguage || 'english').toLowerCase();

            // Use fast model (gemini-2.5-flash-lite / default) with concurrency pool for Full Page Translate
            if (resolvedSettings.apiProvider === 'gemini') {
                const batchSettings = {
                    ...resolvedSettings,
                    modelName: resolvedSettings.modelName || 'gemini-2.5-flash-lite',
                    customModel: resolvedSettings.customModel || ''
                };
                streamGeminiAPI(inputJSON, PROMPT_PAGE_BATCH_TRANSLATE, targetLanguage, batchSettings, port, true);
            } else {
                streamGroqAPI(inputJSON, PROMPT_PAGE_BATCH_TRANSLATE, targetLanguage, resolvedSettings, port);
            }
        }
    });
});

// --- Helper Function for Stream Parsing ---
function extractJSONObjects(buffer) {
    const objects = [];
    let startIndex = 0;
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let lastParsedIndex = -1;

    for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                if (braceCount === 0) startIndex = i;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    // Found a complete object
                    const jsonStr = buffer.substring(startIndex, i + 1);
                    try {
                        objects.push(JSON.parse(jsonStr));
                    } catch (e) {
                        // Ignore parse errors for partial/malformed chunks
                    }
                    lastParsedIndex = i;
                }
            }
        }
    }

    // Return remaining buffer (everything after the last successfully parsed object)
    const remainingBuffer = lastParsedIndex !== -1 ? buffer.substring(lastParsedIndex + 1) : buffer;

    return { remainingBuffer, objects };
}

// --- Initial Load Call ---
settingsReadyPromise = loadSettings();