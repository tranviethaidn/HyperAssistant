// settings.js - Manages the HyperAssistant settings page
import { uiTranslations } from './ui_translations.js';
import { LANGUAGES } from './languages.js';
import { applyTranslations } from './utils/i18n.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { initializeTheme, toggleTheme } from './utils/theme.js';

document.addEventListener('DOMContentLoaded', async function () {
    // Theme handling
    const themeToggle = document.getElementById('theme-toggle');

    // Initialize theme based on system preference
    initializeTheme();

    // Add click handler for theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Tab handling
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(tabId) {
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    // Language handling
    const defaultTargetLanguage = document.getElementById('default-target-language');

    // Only populates the dropdown, doesn't set the value
    function initializeLanguages() {
        // Clear existing options
        defaultTargetLanguage.innerHTML = '';

        // Add language options
        LANGUAGES.forEach(language => {
            const option = document.createElement('option');
            option.value = language.toLowerCase(); // Store lowercase value
            // Capitalize first letter for display
            option.textContent = language.charAt(0).toUpperCase() + language.slice(1);
            defaultTargetLanguage.appendChild(option);
        });
    }

    // UI Language Selector
    const uiLanguageSelect = document.getElementById('ui-language-select');

    // API Provider handling
    const apiProviderSelect = document.getElementById('api-provider');
    const geminiSettings = document.getElementById('gemini-settings');
    const groqSettings = document.getElementById('groq-settings');

    function toggleAPISettings(provider) {
        if (provider === 'gemini') {
            geminiSettings.style.display = 'block';
            groqSettings.style.display = 'none';
        } else if (provider === 'groq') {
            geminiSettings.style.display = 'none';
            groqSettings.style.display = 'block';
        }

        // Clear any old test outputs when switching provider
        clearInlineStatus(modelTestResult);
        clearInlineStatus(groqModelTestResult);

        // Ensure Custom Model input is shown/hidden correctly
        toggleCustomModelVisibility();
    }

    apiProviderSelect.addEventListener('change', function () {
        toggleAPISettings(this.value);
    });

    // Form elements - Gemini
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-name');
    const customModelInput = document.getElementById('custom-model');
    const customModelGroup = document.getElementById('custom-model-group');
    const testModelButton = document.getElementById('test-model');
    const modelTestResult = document.getElementById('model-test-result');
    const geminiApiModelSettings = document.getElementById('gemini-api-model-settings');
    const geminiLiveModelSettings = document.getElementById('gemini-live-model-settings');
    const geminiModeApiRadio = document.getElementById('gemini-mode-api');
    const geminiModeLiveRadio = document.getElementById('gemini-mode-live');
    const liveModelIdInput = document.getElementById('live-model-id');
    const testLiveModelButton = document.getElementById('test-live-model');
    const liveModelTestResult = document.getElementById('live-model-test-result');
    const temperatureInput = document.getElementById('temperature');
    const topKInput = document.getElementById('top-k');
    const topPInput = document.getElementById('top-p');
    const maxTokensInput = document.getElementById('max-output-tokens');

    // Form elements - Groq
    const groqApiKeyInput = document.getElementById('groq-api-key');
    const groqModelSelect = document.getElementById('groq-model-name');
    const groqTemperatureInput = document.getElementById('groq-temperature');
    const groqMaxTokensInput = document.getElementById('groq-max-tokens');
    const testGroqModelButton = document.getElementById('test-groq-model');
    const groqModelTestResult = document.getElementById('groq-model-test-result');

    // Common form elements
    const emotionStyle = document.getElementById('emotion-style');
    const saveButton = document.getElementById('save');
    const resetButton = document.getElementById('reset');
    const statusMessage = document.getElementById('status');
    const LOG_PREFIX = "[HyperAssistantSettings]"; // Define log prefix if not already

    function getCurrentUILanguage() {
        return uiLanguageSelect?.value || 'en';
    }

    function t(key) {
        const lang = getCurrentUILanguage();
        return uiTranslations?.[lang]?.[key] || uiTranslations?.en?.[key] || key;
    }

    function showInlineStatus(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `status ${type}`;
        element.style.display = 'block';
    }

    function clearInlineStatus(element) {
        if (!element) return;
        element.textContent = '';
        element.className = 'status';
        element.style.display = 'none';
    }

    function normalizeGeminiModelId(modelId) {
        return String(modelId || '').trim().replace(/^models\//i, '');
    }

    function getSelectedGeminiMode() {
        if (geminiModeLiveRadio?.checked) return 'live';
        return 'api';
    }

    function toggleCustomModelVisibility() {
        if (!customModelGroup || !modelSelect) return;
        const isCustom = modelSelect.value === 'custom';
        customModelGroup.style.display = isCustom ? 'block' : 'none';
    }

    function toggleGeminiModeUI() {
        const mode = getSelectedGeminiMode();
        if (geminiApiModelSettings) {
            geminiApiModelSettings.style.display = mode === 'api' ? 'block' : 'none';
        }
        if (geminiLiveModelSettings) {
            geminiLiveModelSettings.style.display = mode === 'live' ? 'block' : 'none';
        }

        // Clear results when switching mode
        clearInlineStatus(modelTestResult);
        clearInlineStatus(liveModelTestResult);
    }

    // Load saved settings - Now handles setting the language dropdown value
    function loadSettings() {
        chrome.storage.sync.get(['settings'], function (result) {
            // Merge to ensure new fields always have defaults
            const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

            // API Provider
            apiProviderSelect.value = settings.apiProvider || DEFAULT_SETTINGS.apiProvider;
            toggleAPISettings(apiProviderSelect.value);

            // Gemini settings
            apiKeyInput.value = settings.apiKey || '';
            customModelInput.value = settings.customModel || '';

            if ((settings.customModel || '').trim().length > 0) {
                modelSelect.value = 'custom';
            } else {
                modelSelect.value = settings.modelName || DEFAULT_SETTINGS.modelName;
            }

            toggleCustomModelVisibility();
            temperatureInput.value = settings.temperature ?? '';
            topKInput.value = settings.topK ?? '';
            topPInput.value = settings.topP ?? '';
            maxTokensInput.value = settings.maxOutputTokens ?? '';

            // Gemini mode (API vs Live API)
            const geminiMode = settings.geminiMode || 'api';
            if (geminiModeApiRadio) geminiModeApiRadio.checked = geminiMode !== 'live';
            if (geminiModeLiveRadio) geminiModeLiveRadio.checked = geminiMode === 'live';
            if (liveModelIdInput) liveModelIdInput.value = settings.liveModelId || DEFAULT_SETTINGS.liveModelId || '';
            toggleGeminiModeUI();

            // Groq settings
            groqApiKeyInput.value = settings.groqApiKey || '';
            groqModelSelect.value = settings.groqModelName || DEFAULT_SETTINGS.groqModelName;
            groqTemperatureInput.value = settings.groqTemperature ?? '';
            groqMaxTokensInput.value = settings.groqMaxTokens ?? '';

            // Common settings
            emotionStyle.value = settings.emotionStyle || DEFAULT_SETTINGS.emotionStyle;

            // Set the language dropdown value *after* it has been populated
            defaultTargetLanguage.value = settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
        });
    }

    // Save settings
    async function saveSettings() {
        const currentProvider = apiProviderSelect.value;
        const isGeminiCustomModel = modelSelect.value === 'custom';
        const geminiMode = getSelectedGeminiMode();

        const settings = {
            apiProvider: currentProvider,
            // Gemini settings
            apiKey: apiKeyInput.value.trim(),
            modelName: isGeminiCustomModel ? (DEFAULT_SETTINGS.modelName || 'gemini-2.5-flash-lite') : modelSelect.value,
            customModel: isGeminiCustomModel ? customModelInput.value.trim() : '',
            geminiMode: geminiMode,
            liveModelId: normalizeGeminiModelId(liveModelIdInput?.value || ''),
            temperature: temperatureInput.value.trim() === '' ? null : Number(temperatureInput.value),
            topK: topKInput.value.trim() === '' ? null : parseInt(topKInput.value, 10),
            topP: topPInput.value.trim() === '' ? null : Number(topPInput.value),
            maxOutputTokens: maxTokensInput.value.trim() === '' ? null : parseInt(maxTokensInput.value, 10),
            // Groq settings
            groqApiKey: groqApiKeyInput.value.trim(),
            groqModelName: groqModelSelect.value,
            groqTemperature: groqTemperatureInput.value.trim() === '' ? null : Number(groqTemperatureInput.value),
            groqMaxTokens: groqMaxTokensInput.value.trim() === '' ? null : parseInt(groqMaxTokensInput.value, 10),
            // Common settings
            defaultTargetLanguage: defaultTargetLanguage.value,
            emotionStyle: emotionStyle.value,
            uiLanguage: uiLanguageSelect ? uiLanguageSelect.value : 'en'
        };

        // Validate settings based on selected provider
        if (currentProvider === 'gemini') {
            if (!settings.apiKey) {
                showStatus('Please enter a Gemini API key', 'error');
                return;
            }

            if (settings.geminiMode === 'live' && !settings.liveModelId) {
                showStatus('Please enter a Live API model ID', 'error');
                return;
            }

            if (isGeminiCustomModel && !settings.customModel) {
                showStatus('Please enter a custom model ID', 'error');
                return;
            }

            if (settings.temperature !== null && (settings.temperature < 0 || settings.temperature > 1)) {
                showStatus('Temperature must be between 0 and 1', 'error');
                return;
            }

            if (settings.topK !== null && (settings.topK < 1 || settings.topK > 40)) {
                showStatus('Top-K must be between 1 and 40', 'error');
                return;
            }

            if (settings.topP !== null && (settings.topP < 0 || settings.topP > 1)) {
                showStatus('Top-P must be between 0 and 1', 'error');
                return;
            }

            if (settings.maxOutputTokens !== null && (settings.maxOutputTokens < 1 || settings.maxOutputTokens > 8192)) {
                showStatus('Max tokens must be between 1 and 8192', 'error');
                return;
            }
        } else if (currentProvider === 'groq') {
            if (!settings.groqApiKey) {
                showStatus('Please enter a Groq API key', 'error');
                return;
            }

            if (settings.groqTemperature !== null && (settings.groqTemperature < 0 || settings.groqTemperature > 2)) {
                showStatus('Temperature must be between 0 and 2', 'error');
                return;
            }

            if (settings.groqMaxTokens !== null && (settings.groqMaxTokens < 1 || settings.groqMaxTokens > 8192)) {
                showStatus('Max tokens must be between 1 and 8192', 'error');
                return;
            }
        }

        chrome.storage.sync.set({ 'settings': settings }, function () {
            if (chrome.runtime.lastError) {
                showStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }
            showStatus('Settings saved successfully!', 'success');
        });
    }

    async function testGeminiModel() {
        clearInlineStatus(modelTestResult);

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showInlineStatus(modelTestResult, t('modelTestMissingApiKeyGemini'), 'error');
            return;
        }

        let modelId = '';
        if (modelSelect.value === 'custom') {
            modelId = normalizeGeminiModelId(customModelInput.value);
            if (!modelId) {
                showInlineStatus(modelTestResult, t('modelTestMissingCustomModel'), 'error');
                return;
            }
        } else {
            modelId = normalizeGeminiModelId(modelSelect.value);
        }

        const originalText = testModelButton?.textContent;
        if (testModelButton) {
            testModelButton.disabled = true;
            testModelButton.textContent = t('testingModelButton');
        }

        try {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const requestBody = {
                contents: [{ parts: [{ text: 'Reply with OK.' }] }],
                generationConfig: { maxOutputTokens: 8, temperature: 0 }
            };

            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            const isRetryable = (status) => status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

            let response = null;
            let lastFetchError = null;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (response.ok) break;
                    if (!isRetryable(response.status) || attempt === 3) break;

                    const baseDelay = 600;
                    const delayMs = Math.min(5000, baseDelay * Math.pow(2, attempt - 1));
                    await sleep(delayMs);
                } catch (e) {
                    lastFetchError = e;
                    if (attempt === 3) break;
                    const baseDelay = 600;
                    const delayMs = Math.min(5000, baseDelay * Math.pow(2, attempt - 1));
                    await sleep(delayMs);
                }
            }

            if (!response) {
                throw lastFetchError || new Error('Request failed');
            }

            if (!response.ok) {
                const responseText = await response.text();
                let errorMsg = responseText;
                try {
                    const errorData = JSON.parse(responseText);
                    if (errorData?.error?.message) errorMsg = errorData.error.message;
                    else if (errorData?.message) errorMsg = errorData.message;
                } catch (_) {
                    // ignore
                }

                if (response.status === 429) errorMsg = 'Too many requests. Please try again in a few seconds.';
                if (response.status === 503) errorMsg = 'Gemini service is temporarily unavailable or overloaded (503). Please try again in a few seconds.';

                showInlineStatus(
                    modelTestResult,
                    `${t('modelTestFailed')} ${errorMsg}\n${t('modelInUseLabel')} ${modelId}`,
                    'error'
                );
                return;
            }

            showInlineStatus(modelTestResult, `${t('modelTestSuccess')}\n${t('modelInUseLabel')} ${modelId}`, 'success');
        } catch (e) {
            showInlineStatus(modelTestResult, `${t('modelTestFailed')} ${e?.message || e}\n${t('modelInUseLabel')} ${modelId}`, 'error');
        } finally {
            if (testModelButton) {
                testModelButton.disabled = false;
                testModelButton.textContent = originalText || t('testModelButton');
            }
        }
    }

    async function testGeminiLiveAPI() {
        clearInlineStatus(liveModelTestResult);

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showInlineStatus(liveModelTestResult, t('modelTestMissingApiKeyGemini'), 'error');
            return;
        }

        const modelId = normalizeGeminiModelId(liveModelIdInput?.value || '');
        if (!modelId) {
            showInlineStatus(liveModelTestResult, t('liveApiMissingModelId'), 'error');
            return;
        }

        const originalText = testLiveModelButton?.textContent;
        if (testLiveModelButton) {
            testLiveModelButton.disabled = true;
            testLiveModelButton.textContent = t('testingLiveApiButton');
        }

        // Live API WebSocket endpoint format (per Google docs):
        // wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
        const modelResource = `models/${modelId}`;

        let socket = null;
        let finished = false;
        let opened = false;
        let sentTestInput = false;
        let lastServerError = '';
        let errorEventSeen = false;
        let errorFinishHandle = null;
        let setupCompleteSeen = false;
        let setupCompleteTimeoutHandle = null;
        let responseTimeoutHandle = null;

        function getCloseDetails(event) {
            if (!event) return '';
            const code = typeof event.code === 'number' ? event.code : null;
            const reason = String(event.reason || '').trim();
            if (code === null && !reason) return '';
            if (code !== null && reason) return ` (${code} - ${reason})`;
            if (code !== null) return ` (${code})`;
            return ` (${reason})`;
        }

        function sendTestInput() {
            if (finished || !socket || socket.readyState !== WebSocket.OPEN) return;
            if (sentTestInput) return;

            // Use clientContent with turnComplete=true to reliably trigger generation.
            const clientMessage = {
                clientContent: {
                    turns: [
                        {
                            role: 'user',
                            parts: [{ text: 'Reply with OK.' }]
                        }
                    ],
                    turnComplete: true
                }
            };

            try {
                socket.send(JSON.stringify(clientMessage));
                sentTestInput = true;

                // Start response timeout only after we have actually sent a turn.
                if (responseTimeoutHandle) clearTimeout(responseTimeoutHandle);
                responseTimeoutHandle = setTimeout(() => {
                    if (finished) return;
                    finish(false, `${t('modelTestFailed')} ${t('liveApiTimeoutAfterSetup')}`);
                }, 12000);
            } catch (_) {
                // ignore
            }
        }

        function finish(success, message) {
            if (finished) return;
            finished = true;

            if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
            if (setupCompleteTimeoutHandle) clearTimeout(setupCompleteTimeoutHandle);
            if (responseTimeoutHandle) clearTimeout(responseTimeoutHandle);
            if (errorFinishHandle) clearTimeout(errorFinishHandle);

            try {
                if (socket && socket.readyState === WebSocket.OPEN) socket.close();
            } catch (_) {
                // ignore
            }

            const type = success ? 'success' : 'error';
            showInlineStatus(
                liveModelTestResult,
                `${message}\n${t('modelInUseLabel')} ${modelId}`,
                type
            );

            if (testLiveModelButton) {
                testLiveModelButton.disabled = false;
                testLiveModelButton.textContent = originalText || t('testLiveApiButton');
            }
        }

        const connectTimeoutMs = 6000;
        const setupCompleteTimeoutMs = 8000;

        let connectTimeoutHandle = null;

        connectTimeoutHandle = setTimeout(() => {
            if (!opened) {
                finish(false, `${t('modelTestFailed')} ${t('liveApiConnectFailed')}`);
            }
        }, connectTimeoutMs);

        try {
            socket = new WebSocket(wsUrl);
            socket.binaryType = 'arraybuffer';

            socket.addEventListener('open', () => {
                opened = true;
                if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);

                // 1) Initial setup (must be the first message)
                // Live API reference: client message must be { setup: BidiGenerateContentSetup }
                const setupMessage = {
                    setup: {
                        model: modelResource,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            maxOutputTokens: 32,
                            temperature: 0
                        },
                        systemInstruction: {
                            parts: [{ text: 'You are a helpful assistant.' }]
                        },
                        // Enables outputTranscription in serverContent (AudioTranscriptionConfig has no fields)
                        outputAudioTranscription: {}
                    }
                };

                try {
                    socket.send(JSON.stringify(setupMessage));
                } catch (_) {
                    // ignore
                }

                // 2) Strictly wait for setupComplete. If it never arrives, fail fast with a clearer message.
                if (setupCompleteTimeoutHandle) clearTimeout(setupCompleteTimeoutHandle);
                setupCompleteTimeoutHandle = setTimeout(() => {
                    if (finished) return;
                    if (!setupCompleteSeen) {
                        finish(false, `${t('modelTestFailed')} ${t('liveApiTimeoutSetup')}`);
                    }
                }, setupCompleteTimeoutMs);
            });

            socket.addEventListener('message', async (event) => {
                if (finished) return;

                let payloadText = '';
                try {
                    if (typeof event.data === 'string') {
                        payloadText = event.data;
                    } else if (event.data instanceof Blob) {
                        payloadText = await event.data.text();
                    } else if (event.data instanceof ArrayBuffer) {
                        payloadText = new TextDecoder('utf-8').decode(event.data);
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
                    const message = msg?.error?.message || msg?.error?.status || JSON.stringify(msg.error);
                    lastServerError = String(message || '').trim();
                    finish(false, `${t('modelTestFailed')} ${lastServerError || t('liveApiUnknownServerError')}`);
                    return;
                }

                // Some servers may still emit setupComplete; treat as progress
                if (msg.setupComplete) {
                    setupCompleteSeen = true;
                    if (setupCompleteTimeoutHandle) {
                        clearTimeout(setupCompleteTimeoutHandle);
                        setupCompleteTimeoutHandle = null;
                    }
                    if (!sentTestInput) sendTestInput();
                    return;
                }

                if (msg.serverContent) {
                    const serverContent = msg.serverContent;

                    const parts = serverContent?.modelTurn?.parts || [];
                    // Success condition 1: we got any audio bytes
                    const hasAudioInlineData = parts.some(p => typeof p?.inlineData?.data === 'string' && p.inlineData.data.length > 0);
                    if (hasAudioInlineData) {
                        finish(true, t('modelTestSuccess'));
                        return;
                    }

                    // Success condition 2: we got any transcription or text
                    const partText = parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
                    const transcriptionText = (serverContent?.outputTranscription?.text || '').trim();
                    const anyText = (partText || transcriptionText).trim();

                    if (anyText.length > 0) {
                        finish(true, t('modelTestSuccess'));
                        return;
                    }
                }

                if (msg.goAway) {
                    finish(false, `${t('modelTestFailed')} ${t('liveApiGoAway')}`);
                }
            });

            socket.addEventListener('error', () => {
                if (finished) return;
                errorEventSeen = true;
                if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
                // Important: don't finish immediately. Chrome often fires 'error'
                // first, then 'close' with a code (e.g. 1006). Waiting briefly
                // lets us surface more useful diagnostics.
                if (errorFinishHandle) clearTimeout(errorFinishHandle);
                errorFinishHandle = setTimeout(() => {
                    if (finished) return;
                    finish(false, `${t('modelTestFailed')} ${t('liveApiSocketError')}`);
                }, 400);
            });

            socket.addEventListener('close', (event) => {
                if (finished) return;
                if (errorFinishHandle) clearTimeout(errorFinishHandle);
                if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
                if (setupCompleteTimeoutHandle) clearTimeout(setupCompleteTimeoutHandle);
                if (responseTimeoutHandle) clearTimeout(responseTimeoutHandle);
                const details = opened
                    ? `${t('liveApiSocketClosed')}${getCloseDetails(event)}${lastServerError ? `\n${lastServerError}` : ''}`
                    : `${t('liveApiConnectFailed')}${getCloseDetails(event)}`;

                const errorPrefix = errorEventSeen ? `${t('liveApiSocketError')} ` : '';
                finish(false, `${t('modelTestFailed')} ${errorPrefix}${details}`);
            });
        } catch (e) {
            if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
            finish(false, `${t('modelTestFailed')} ${e?.message || e}`);
        }
    }

    async function testGroqModel() {
        clearInlineStatus(groqModelTestResult);

        const apiKey = groqApiKeyInput.value.trim();
        if (!apiKey) {
            showInlineStatus(groqModelTestResult, t('modelTestMissingApiKeyGroq'), 'error');
            return;
        }

        const modelId = groqModelSelect.value;
        const originalText = testGroqModelButton?.textContent;
        if (testGroqModelButton) {
            testGroqModelButton.disabled = true;
            testGroqModelButton.textContent = t('testingModelButton');
        }

        try {
            const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            const requestBody = {
                model: modelId,
                messages: [{ role: 'user', content: 'Reply with OK.' }],
                max_tokens: 8,
                temperature: 0,
                stream: false
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const responseText = await response.text();
                let errorMsg = responseText;
                try {
                    const errorData = JSON.parse(responseText);
                    const message = errorData?.error?.message || errorData?.message;
                    if (message) errorMsg = message;
                } catch (_) {
                    // ignore
                }
                showInlineStatus(
                    groqModelTestResult,
                    `${t('modelTestFailed')} ${errorMsg}\n${t('modelInUseLabel')} ${modelId}`,
                    'error'
                );
                return;
            }

            showInlineStatus(groqModelTestResult, `${t('modelTestSuccess')}\n${t('modelInUseLabel')} ${modelId}`, 'success');
        } catch (e) {
            showInlineStatus(groqModelTestResult, `${t('modelTestFailed')} ${e?.message || e}\n${t('modelInUseLabel')} ${modelId}`, 'error');
        } finally {
            if (testGroqModelButton) {
                testGroqModelButton.disabled = false;
                testGroqModelButton.textContent = originalText || t('testModelButton');
            }
        }
    }

    // Reset settings to defaults
    function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to their default values?')) {
            chrome.storage.sync.set({ 'settings': DEFAULT_SETTINGS }, function () {
                if (chrome.runtime.lastError) {
                    showStatus(`Error resetting settings: ${chrome.runtime.lastError.message}`, 'error');
                    return;
                }
                loadSettings();
                showStatus('Settings reset to defaults', 'success');
            });
        }
    }

    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        statusMessage.style.display = 'block';

        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    // --- UI Language Logic ---
    function loadAndApplyUILanguage() {
        chrome.storage.sync.get(['settings'], function (syncResult) {
            const lang = syncResult.settings?.uiLanguage || 'en';
            if (uiLanguageSelect) uiLanguageSelect.value = lang;
            applyTranslations(lang);
        });
    }

    uiLanguageSelect.addEventListener('change', function () {
        const newLang = this.value;
        chrome.storage.local.set({ 'uiLanguage': newLang });
        chrome.storage.sync.get(['settings'], function (result) {
            const currentSettings = result.settings || {};
            currentSettings.uiLanguage = newLang;
            chrome.storage.sync.set({ 'settings': currentSettings }, function () {
                applyTranslations(newLang);
            });
        });
    });

    // --- Model UI logic (Gemini) ---
    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            toggleCustomModelVisibility();
            clearInlineStatus(modelTestResult);
        });
    }

    if (geminiModeApiRadio) {
        geminiModeApiRadio.addEventListener('change', () => {
            toggleGeminiModeUI();
        });
    }
    if (geminiModeLiveRadio) {
        geminiModeLiveRadio.addEventListener('change', () => {
            toggleGeminiModeUI();
        });
    }

    if (customModelInput) {
        customModelInput.addEventListener('input', () => {
            clearInlineStatus(modelTestResult);
        });
    }

    // --- Test buttons ---
    if (testModelButton) {
        testModelButton.addEventListener('click', testGeminiModel);
    }
    if (testLiveModelButton) {
        testLiveModelButton.addEventListener('click', testGeminiLiveAPI);
    }
    if (testGroqModelButton) {
        testGroqModelButton.addEventListener('click', testGroqModel);
    }

    // Add event listeners
    saveButton.addEventListener('click', saveSettings);
    resetButton.addEventListener('click', resetSettings);

    // --- Initialization Order --- 
    // 1. Populate languages
    initializeLanguages();
    // 2. Load all settings, including setting the language dropdown value
    loadSettings();
    // 3. Load UI language preference and apply translations
    loadAndApplyUILanguage();

});