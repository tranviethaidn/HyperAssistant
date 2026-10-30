// utils/theme.js - Shared theme handling logic

/**
 * Initializes the theme based on system preference or saved setting.
 */
export function initializeTheme() {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    // Listen for system theme changes using modern event listener
    const themeChangeHandler = (e) => {
        document.body.classList.toggle('dark-theme', e.matches);
        chrome.storage.local.set({ 'theme': e.matches ? 'dark' : 'light' });
    };

    if (prefersDarkScheme.addEventListener) {
        prefersDarkScheme.addEventListener('change', themeChangeHandler);
    } else if (prefersDarkScheme.addListener) {
        prefersDarkScheme.addListener(themeChangeHandler);
    }

    // Load saved theme preference
    chrome.storage.local.get(['theme'], function (result) {
        if (result.theme) {
            document.body.classList.toggle('dark-theme', result.theme === 'dark');
        } else {
            const isDark = prefersDarkScheme.matches;
            document.body.classList.toggle('dark-theme', isDark);
            chrome.storage.local.set({ 'theme': isDark ? 'dark' : 'light' });
        }
    });
}

/**
 * Toggles the theme between dark and light modes.
 */
export function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    chrome.storage.local.set({ 'theme': isDark ? 'dark' : 'light' });
}
