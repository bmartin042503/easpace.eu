// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

// a fixed header taller than this share of the screen (very large text on a phone) scrolls away instead
const MAX_FIXED_SHARE = 0.2;

/**
 * Marks the fixed header once the page is scrolled, so CSS can give it a background over the content below, and
 * publishes its height as --header-height, so the content always starts below it, whatever the text size.
 */
export function initHeader() {
    const header = document.querySelector(".site-header");

    if (!header) return;

    const updateScrolled = () => header.classList.toggle("is-scrolled", window.scrollY > 0);

    const updateSize = () => {
        const height = header.getBoundingClientRect().height;

        document.documentElement.style.setProperty("--header-height", `${height}px`);
        header.classList.toggle("is-tall", height > window.innerHeight * MAX_FIXED_SHARE);
    };

    window.addEventListener("scroll", updateScrolled, { passive: true });
    window.addEventListener("resize", updateSize);
    new ResizeObserver(updateSize).observe(header);

    updateScrolled();
    updateSize();
}
