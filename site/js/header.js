// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

/**
 * Marks the fixed header once the page is scrolled, so CSS can give it a background over the content below.
 */
export function initHeader() {
    const header = document.querySelector(".site-header");

    if (!header) return;

    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 0);

    window.addEventListener("scroll", update, { passive: true });
    update();
}
