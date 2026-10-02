// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

// the app's preference key and values (System, Light, Dark)
const STORAGE_KEY = "color-scheme-appearance";
const APPEARANCES = ["system", "light", "dark"];

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Reads the visitor's explicit appearance choice; "system" when there is none or storage is blocked.
 */
function readAppearance() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return APPEARANCES.includes(stored) ? stored : "system";
    } catch {
        return "system";
    }
}

function storeAppearance(appearance) {
    try {
        localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
        // storage blocked (private mode, disabled site data): the choice lasts for this page view only
    }
}

/**
 * Sets the resolved theme on the root element and announces a change with a "themechange" event.
 * @param {string} appearance "system", "light" or "dark".
 */
function applyAppearance(appearance) {
    const root = document.documentElement;
    const theme = appearance === "dark" || (appearance === "system" && darkQuery.matches) ? "dark" : "light";
    const changed = root.dataset.theme !== theme;

    root.dataset.theme = theme;
    updateThemeColor();

    if (changed) {
        document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
    }
}

/**
 * Tints the browser's UI with the page background of the current theme.
 */
function updateThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = getComputedStyle(document.documentElement).getPropertyValue("--sem-background-blobs").trim();

    if (meta && color) {
        meta.content = color;
    }
}

/**
 * Connects the appearance switch, applies the current appearance and follows OS changes while System is selected.
 * The head script has already set the initial theme, so this causes no flash.
 */
export function initTheme() {
    let appearance = readAppearance();

    for (const input of document.querySelectorAll('input[name="appearance"]')) {
        input.checked = input.value === appearance;

        input.addEventListener("change", () => {
            if (!input.checked) return;

            appearance = input.value;
            storeAppearance(appearance);
            applyAppearance(appearance);
        });
    }

    darkQuery.addEventListener("change", () => {
        if (appearance === "system") applyAppearance(appearance);
    });

    applyAppearance(appearance);
}
