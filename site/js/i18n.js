// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

import hu from "./locales/hu.js";

// the app's preference key and values
const STORAGE_KEY = "language";
const LANGUAGES = ["en", "hu"];

// English is recorded from the page on load; Hungarian comes from its dictionary
const dictionaries = { en: {}, hu };

/**
 * Lists the translated attributes of an element: data-i18n-attr="aria-label:Some.Key, title:Other.Key".
 */
function translatedAttributes(element) {
    return element.dataset.i18nAttr.split(",").map((pair) => {
        const [attribute, key] = pair.split(":").map((part) => part.trim());
        return { attribute, key };
    });
}

/**
 * Records the page's English texts and attributes, so switching back to English needs no second dictionary.
 */
function recordEnglish() {
    for (const element of document.querySelectorAll("[data-i18n]")) {
        dictionaries.en[element.dataset.i18n] = element.textContent;
    }

    for (const element of document.querySelectorAll("[data-i18n-attr]")) {
        for (const { attribute, key } of translatedAttributes(element)) {
            dictionaries.en[key] = element.getAttribute(attribute);
        }
    }
}

/**
 * Replaces every translated text and attribute in place and sets the document language.
 * Missing translations fall back to English.
 * @param {string} language "en" or "hu".
 */
function applyLanguage(language) {
    const root = document.documentElement;
    const translate = (key) => dictionaries[language][key] ?? dictionaries.en[key];

    for (const element of document.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(element.dataset.i18n);
    }

    for (const element of document.querySelectorAll("[data-i18n-attr]")) {
        for (const { attribute, key } of translatedAttributes(element)) {
            element.setAttribute(attribute, translate(key));
        }
    }

    root.lang = language;

    // the head script hides the page for non-English visitors until this point
    root.classList.remove("i18n-pending");
}

function storeLanguage(language) {
    try {
        localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // storage blocked (private mode, disabled site data): the choice lasts for this page view only
    }
}

/**
 * Warns about keys used on the page but missing in a dictionary, and the other way around. Development only.
 */
function checkKeys() {
    const pageKeys = Object.keys(dictionaries.en);

    for (const [language, dictionary] of Object.entries(dictionaries)) {
        if (language === "en") continue;

        const missing = pageKeys.filter((key) => !(key in dictionary));
        const unused = Object.keys(dictionary).filter((key) => !pageKeys.includes(key));

        if (missing.length) console.warn(`i18n: missing in ${language}.js:`, missing);
        if (unused.length) console.warn(`i18n: not used on the page but present in ${language}.js:`, unused);
    }
}

/**
 * Applies the language chosen by the head script and connects the language switch.
 */
export function initI18n() {
    recordEnglish();

    // the head script has resolved the stored choice or the browser languages into <html lang>
    let language = LANGUAGES.includes(document.documentElement.lang) ? document.documentElement.lang : "en";

    for (const input of document.querySelectorAll('input[name="language"]')) {
        input.checked = input.value === language;

        input.addEventListener("change", () => {
            if (!input.checked) return;

            language = input.value;
            storeLanguage(language);
            applyLanguage(language);
        });
    }

    applyLanguage(language);

    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
        checkKeys();
    }
}
