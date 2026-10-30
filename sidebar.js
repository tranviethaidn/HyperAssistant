// sidebar.js
// Handles interactions within the HyperAssistant sidebar panel.
import { uiTranslations } from './ui_translations.js';
import { LANGUAGES } from './languages.js';
import { applyTranslations } from './utils/i18n.js';
import { initializeTheme, toggleTheme } from './utils/theme.js';

// Get Elements
const inputTextElem = document.getElementById('fast-translate-input');
const outputTextElem = document.getElementById('fast-translate-output');
const statusElem = document.getElementById('fast-translate-status');
const sendButton = document.getElementById('fast-translate-send');
const optionsButton = document.getElementById('options-button');
const targetLanguageSelect = document.getElementById('target-language');
const themeToggle = document.getElementById('theme-toggle');

const LOG_PREFIX = "[HyperAssistantSidebar]";

// --- Initialization and Global State --- 
let currentUILanguage = 'en'; // Store current UI language

// Initialize language dropdown (translation target)
function initializeLanguageDropdown() {
    if (!targetLanguageSelect) return;

    targetLanguageSelect.innerHTML = '';
    LANGUAGES.forEach(language => {
        const option = document.createElement('option');
        option.value = language.toLowerCase(); // Use lowercase for value
        // Capitalize first letter for display
        option.textContent = language.charAt(0).toUpperCase() + language.slice(1);
        targetLanguageSelect.appendChild(option);
    });
    targetLanguageSelect.value = 'english';
    chrome.storage.sync.get(['settings'], (result) => {
        const defaultLang = result.settings?.defaultTargetLanguage;
        if (defaultLang && targetLanguageSelect) {
            targetLanguageSelect.value = defaultLang.toLowerCase();
        }
    });
}

// Add click handler for theme toggle
themeToggle.addEventListener('click', toggleTheme);

// --- Event Listeners Setup --- 
function setupEventListeners() {
    if (sendButton) {
        sendButton.addEventListener('click', handleTranslateRequest);
    }
    if (optionsButton) {
        optionsButton.addEventListener('click', openOptionsPage);
    }

    // Add click-to-copy listener to output area
    if (outputTextElem) {
        outputTextElem.addEventListener('click', handleCopyOutput);
    }

    if (inputTextElem) {
        inputTextElem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleTranslateRequest();
            }
        });
    }
}

// --- Core Functions --- 

function handleTranslateRequest() {
    if (!inputTextElem || !sendButton || !targetLanguageSelect) return;

    const textToTranslate = inputTextElem.value.trim();
    const targetLanguage = targetLanguageSelect.value;
    const translations = uiTranslations[currentUILanguage] || uiTranslations.en; // Fallback to English

    // Disable button and set translating text
    sendButton.disabled = true;
    sendButton.textContent = translations.translatingButton || 'Translating...';

    if (!textToTranslate) {
        updateStatus(translations.statusEnterText || "Please enter text to translate.", true);
        clearOutput(translations.outputPlaceholder);
        resetSendButton(translations.translateButton);
        return;
    }

    updateStatus(translations.statusTranslating || "Translating...", false);
    clearOutput(translations.outputPlaceholder); // Clear previous result

    // Use Long-lived connection for streaming
    const port = chrome.runtime.connect({ name: "sidebar_stream" });

    // Send the translation request
    port.postMessage({
        action: "translateInputText",
        text: textToTranslate,
        targetLanguage: targetLanguage
    });

    let fullTranslation = "";

    port.onMessage.addListener((msg) => {
        if (msg.action === "chunk") {
            // Append chunk to output
            if (fullTranslation === "") {
                // First chunk, clear placeholder styling if any
                outputTextElem.classList.remove('placeholder');
                outputTextElem.value = "";
            }
            fullTranslation += msg.text;
            outputTextElem.value = fullTranslation;
            // Auto-scroll to bottom
            outputTextElem.scrollTop = outputTextElem.scrollHeight;
        } else if (msg.action === "done") {
            updateStatus(translations.statusTranslated || "Translated successfully.", false, true);
            resetSendButton(translations.translateButton);
            port.disconnect();
        } else if (msg.action === "error") {
            const errorMsg = `${translations.statusError || 'Error:'} ${msg.error}`;
            updateStatus(errorMsg, true);
            displayOutput(`Translation failed. ${msg.error}`);
            resetSendButton(translations.translateButton);
            port.disconnect();
        }
    });

    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            const errorMsg = `Connection error: ${chrome.runtime.lastError.message}`;
            updateStatus(errorMsg, true);
            resetSendButton(translations.translateButton);
        }
    });
}

function openOptionsPage() {
    chrome.runtime.openOptionsPage();
}

function updateStatus(message, isError = false, temporary = false) {
    if (!statusElem) return;
    statusElem.textContent = message;
    statusElem.className = 'status' + (isError ? ' error' : (message ? ' success' : ''));

    if (temporary && message) {
        setTimeout(() => {
            if (statusElem.textContent === message) {
                clearStatus();
            }
        }, 2000);
    }
}

function clearStatus() {
    updateStatus("");
}

function displayOutput(text) {
    if (!outputTextElem) return;
    const translations = uiTranslations[currentUILanguage] || uiTranslations.en;
    outputTextElem.value = text; // Use .value for textarea
    if (!text || text === (translations.outputPlaceholder || 'Translation result will appear here...') || text.startsWith('Error') || text.startsWith('Translation failed')) {
        outputTextElem.classList.add('placeholder');
    } else {
        outputTextElem.classList.remove('placeholder');
    }
}

function clearOutput(placeholderText) {
    const defaultPlaceholder = uiTranslations[currentUILanguage]?.outputPlaceholder || uiTranslations.en.outputPlaceholder || 'Translation result will appear here...';
    displayOutput(placeholderText || defaultPlaceholder);
}

function handleCopyOutput(event) { // Event parameter is now the textarea click event
    const outputArea = event.currentTarget; // Textarea itself
    if (!outputArea) return;
    const textToCopy = outputArea.value;
    const translations = uiTranslations[currentUILanguage] || uiTranslations.en;

    if (textToCopy && !outputArea.classList.contains('placeholder')) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Indicate success visually on the textarea
            outputArea.classList.add('copied-success');
            updateStatus(translations.statusCopied || "Copied!", false, true);
            setTimeout(() => {
                outputArea.classList.remove('copied-success');
                // Status will clear itself due to 'temporary' flag
            }, 800); // Duration for visual feedback
        }).catch(err => {
            // console.error(LOG_PREFIX, 'Failed to copy: ', err);
            updateStatus(translations.statusCopyFailed || "Copy failed!", true);
        });
    } else {
        updateStatus(translations.statusNothingToCopy || "Nothing to copy", true, true);
    }
}

function resetSendButton(buttonText) {
    if (sendButton) {
        const text = buttonText || uiTranslations[currentUILanguage]?.translateButton || uiTranslations.en.translateButton || 'Translate';
        sendButton.disabled = false;
        sendButton.textContent = text;
    }
}

// --- UI Language Initialization ---
function loadAndApplyUILanguage() {
    chrome.storage.sync.get(['settings'], function (syncResult) {
        if (syncResult.settings?.uiLanguage) {
            currentUILanguage = syncResult.settings.uiLanguage;
            applyTranslations(currentUILanguage);
            clearOutput();
        } else {
            chrome.storage.local.get(['uiLanguage'], function (result) {
                currentUILanguage = result.uiLanguage || 'en';
                applyTranslations(currentUILanguage);
                clearOutput();
            });
        }
    });
}

// --- Initialization Sequence ---
document.addEventListener('DOMContentLoaded', () => {
    initializeLanguageDropdown(); // Populate translation target dropdown
    initializeTheme();          // Set initial theme
    setupEventListeners();      // Add button listeners etc.
    loadAndApplyUILanguage();   // Load UI language preference and translate UI
});

// console.log(LOG_PREFIX, "Sidebar script loaded.");