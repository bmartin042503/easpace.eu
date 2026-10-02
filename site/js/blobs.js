// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

/*
Port of the desktop app's Controls/BlobsGradientBackground.cs with the onboarding's parameters
(Views/OnboardingPageView.axaml): softly blurred blobs that drift slowly behind the page. As in the app, the blobs
move in a world 200px larger than the screen on every side, bounce off its edges and blend from Sem.Brand.Subtle to
Sem.Brand.Strong. The canvas is shown at the control's opacity of 0.25 by CSS (layout.css).
*/

const BLOB_COUNT = 7;
const SPEED = 0.25;

// positions advance per frame at the app's reference rate; a long gap (a hidden tab) counts as at most 0.05 s
const REFERENCE_FRAME_RATE = 60;
const MAX_DELTA_SECONDS = 0.05;

// the app's blob canvas reaches 200px beyond the control on every side
const WORLD_PADDING = 200;

// Avalonia 12.1.2 turns the app's BlurEffect Radius="90" into a Skia blur with sigma = 0.288675 × 90 + 0.5 ≈ 26.5
const BLUR_SIGMA = 0.288675 * 90 + 0.5;

// below the app's minimum window width the whole system shrinks (size, padding, blur, speed), so phones still show
// separate blobs instead of one wash of color
const APP_MIN_WIDTH = 700;
const MIN_SCALE = 0.5;

// the image is soft, so half the CSS resolution doesn't show and keeps each frame cheap
const RESOLUTION = 0.5;

// about 60 fps at most: a faster screen would only multiply the work
const MIN_FRAME_INTERVAL = 1000 / 60 - 4;

/*
Coverage of a disc edge blurred with sigma: Φ((R − d) / σ) at d = R − 3σ … R + 3σ in steps of σ/2, where Φ is the
standard normal distribution. As radial gradient stops, it gives each blob the app's blur without a filter, which
Safari doesn't support on canvas and which would blur the whole screen on every frame in CSS.
*/
const EDGE_COVERAGE = [
    0.99865, 0.99379, 0.97725, 0.93319, 0.84134, 0.69146, 0.5, 0.30854, 0.15866, 0.06681, 0.02275, 0.00621, 0.00135
];

/**
 * Creates the blobs with the app's random start values, in world coordinates and at full (desktop) size.
 */
function createBlobs(worldWidth, worldHeight) {
    return Array.from({ length: BLOB_COUNT }, () => ({
        x: Math.random() * worldWidth,
        y: Math.random() * worldHeight,
        radius: Math.random() * 150 + 200,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        transition: Math.random(),

        // an integer from 160 to 254 out of 255, as Random.Next(160, 255) in the app
        alpha: (160 + Math.floor(Math.random() * 95)) / 255,

        // "rgba(r, g, b, " for the gradient stops, set by colorBlob
        color: ""
    }));
}

/**
 * Reads a color token as [r, g, b]. The canvas normalizes any opaque CSS color to "#rrggbb".
 */
function readColor(context, token) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();

    context.fillStyle = "#000000";
    context.fillStyle = value;

    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(context.fillStyle);
    return hex ? hex.slice(1).map((part) => parseInt(part, 16)) : [0, 0, 0];
}

/**
 * Gives a blob its color between the two token colors, truncated per channel as the app's byte cast does.
 */
function colorBlob(blob, from, to) {
    const channel = (i) => Math.trunc(from[i] + (to[i] - from[i]) * blob.transition);
    blob.color = `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, `;
}

/**
 * Moves a blob back into the world and points its velocity inwards, as the app does at the edges.
 */
function keepInside(blob, worldWidth, worldHeight) {
    if (blob.x < 0) {
        blob.x = 0;
        blob.vx = Math.abs(blob.vx);
    } else if (blob.x > worldWidth) {
        blob.x = worldWidth;
        blob.vx = -Math.abs(blob.vx);
    }

    if (blob.y < 0) {
        blob.y = 0;
        blob.vy = Math.abs(blob.vy);
    } else if (blob.y > worldHeight) {
        blob.y = worldHeight;
        blob.vy = -Math.abs(blob.vy);
    }
}

/**
 * Draws a blob as a disc blurred with the app's sigma.
 * @param {number} scale The size factor below the app's minimum width (1 on wider screens).
 */
function drawBlob(context, blob, scale) {
    const padding = WORLD_PADDING * scale;
    const x = blob.x - padding;
    const y = blob.y - padding;
    const radius = blob.radius * scale;
    const sigma = BLUR_SIGMA * scale;
    const outer = radius + 3 * sigma;

    const gradient = context.createRadialGradient(x, y, 0, x, y, outer);
    gradient.addColorStop(0, `${blob.color}${blob.alpha})`);

    EDGE_COVERAGE.forEach((coverage, i) => {
        gradient.addColorStop((radius + (i / 2 - 3) * sigma) / outer, `${blob.color}${blob.alpha * coverage})`);
    });

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, outer, 0, 2 * Math.PI);
    context.fill();
}

/**
 * Starts the blob background on the page's canvas.blobs: sizes it with the canvas, animates it unless the visitor
 * prefers reduced motion (then it's a still image), and re-colors it on "themechange" without moving the blobs.
 */
export function initBlobs() {
    const canvas = document.querySelector("canvas.blobs");
    const context = canvas?.getContext("2d");

    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let blobs = [];
    let width = 0;
    let height = 0;
    let frameRequest = 0;
    let previousTime = null;

    const scale = () => Math.max(MIN_SCALE, Math.min(1, width / APP_MIN_WIDTH));
    const worldSize = () => [width + 2 * WORLD_PADDING * scale(), height + 2 * WORLD_PADDING * scale()];

    function updateColors() {
        const from = readColor(context, "--sem-brand-subtle");
        const to = readColor(context, "--sem-brand-strong");

        blobs.forEach((blob) => colorBlob(blob, from, to));
    }

    function draw() {
        if (!blobs.length) return;

        // resizing the canvas resets its transform, so it's set on every draw
        context.setTransform(RESOLUTION, 0, 0, RESOLUTION, 0, 0);
        context.clearRect(0, 0, width, height);
        blobs.forEach((blob) => drawBlob(context, blob, scale()));

        // fades in once there's something to show
        canvas.classList.add("is-visible");
    }

    function frame(now) {
        frameRequest = requestAnimationFrame(frame);

        if (previousTime !== null) {
            if (now - previousTime < MIN_FRAME_INTERVAL) return;

            const deltaSeconds = Math.min(Math.max((now - previousTime) / 1000, 0), MAX_DELTA_SECONDS);
            const frameScale = deltaSeconds * REFERENCE_FRAME_RATE;
            const [worldWidth, worldHeight] = worldSize();

            for (const blob of blobs) {
                blob.x += blob.vx * scale() * SPEED * frameScale;
                blob.y += blob.vy * scale() * SPEED * frameScale;
                keepInside(blob, worldWidth, worldHeight);
            }

            draw();
        }

        previousTime = now;
    }

    function start() {
        if (frameRequest || reducedMotion.matches || !blobs.length) return;

        previousTime = null;
        frameRequest = requestAnimationFrame(frame);
    }

    function stop() {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
    }

    // the canvas is as tall as the largest viewport (CSS), so mobile toolbars coming and going don't resize it
    new ResizeObserver(([entry]) => {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = Math.max(1, Math.round(width * RESOLUTION));
        canvas.height = Math.max(1, Math.round(height * RESOLUTION));

        if (!width || !height) return;

        const [worldWidth, worldHeight] = worldSize();

        // as in the app, the blobs are created at the first real size and kept on later resizes
        if (!blobs.length) {
            blobs = createBlobs(worldWidth, worldHeight);
            updateColors();
        } else {
            blobs.forEach((blob) => keepInside(blob, worldWidth, worldHeight));
        }

        draw();
        start();
    }).observe(canvas);

    reducedMotion.addEventListener("change", () => (reducedMotion.matches ? stop() : start()));

    document.addEventListener("themechange", () => {
        updateColors();
        draw();
    });

    // after a hidden tab, continue from where the blobs were instead of catching up
    document.addEventListener("visibilitychange", () => {
        previousTime = null;
    });
}
