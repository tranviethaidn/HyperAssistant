import { uiTranslations } from '../ui_translations.js';

/**
 * Applies translations to the DOM based on the provided language.
 * @param {string} lang - The language code (e.g., 'en', 'vi').
 */
export function applyTranslations(lang) {
    if (!uiTranslations || !uiTranslations[lang]) {
        console.warn("[HyperAssistant] Translations not available for language:", lang);
        return;
    }
    const translations = uiTranslations[lang];
    
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        if (translations[key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                // For inputs/textareas, we usually don't set textContent.
                // If there's a specific need, handle it here.
            } else {
                element.textContent = translations[key];
            }
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.dataset.i18nPlaceholder;
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.dataset.i18nTitle;
        if (translations[key]) {
            element.title = translations[key];
        }
    });

    // Translate document title
    const titleElement = document.querySelector('title[data-i18n]');
    if (titleElement) {
        const key = titleElement.dataset.i18n;
        if (translations[key]) {
            document.title = translations[key];
        }
    }
}

/**
 * Retrieves a specific translation string.
 * @param {string} lang - The language code.
 * @param {string} key - The translation key.
 * @returns {string} The translated string or the key if not found.
 */
export function getTranslation(lang, key) {
    return uiTranslations[lang]?.[key] || uiTranslations['en']?.[key] || key;
}
