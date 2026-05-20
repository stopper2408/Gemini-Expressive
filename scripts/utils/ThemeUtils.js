/*
 * Copyright (c) 2026 Fernando Vaz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Calculates and applies custom Material You (Material 3) color palettes programmatically.
 * It handles the complex color math required to convert user-selected hex seed colors into HSL
 * tonal ranges, generating a cohesive CSS variable scheme that overwrites the application's default styles.
 */
class ThemeUtils {
    /**
     * Transforms a standard hexadecimal color code into Hue, Saturation, and Lightness components.
     * This intermediate format is essential for accurately calculating the tonal variants needed for Material You.
     * @param {string} hex - The input hexadecimal color string (e.g., "#FF0000" or "#F00").
     * @returns {number[]} A 3-element array representing [Hue (0-360), Saturation (0-100), Lightness (0-100)].
     */
    static hexToHsl(hex) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

    /**
     * Converts calculated HSL tonal values back into a web-safe hexadecimal string for CSS injection.
     * @param {number} h - The hue value (0-360).
     * @param {number} s - The saturation value (0-100).
     * @param {number} l - The lightness value (0-100).
     * @returns {string} The output hexadecimal color string.
     */
    static hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    /**
     * Translates a hex color into a raw RGB comma-separated string, necessary for CSS variables
     * that require alpha channel modifications via `rgba(var(--color), alpha)`.
     * @param {string} hex - The hexadecimal color string.
     * @returns {string} The RGB integer values separated by commas (e.g., "255, 0, 0").
     */
    static hexToRgbString(hex) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }

    /**
     * Evaluates the active environment to determine if the dark theme scheme should be applied.
     * It checks explicit user overrides, existing DOM classes set by the host application, and system media queries.
     * @param {string} themeMode - The user's specific theme preference ('light', 'dark', or 'auto').
     * @returns {boolean} True if the mathematical calculations should generate a dark-mode tonal palette.
     */
    static isDarkModeActive(themeMode) {
        if (themeMode === 'dark') return true;
        if (themeMode === 'light') return false;

        if (document.body && document.body.getAttribute('data-theme') === 'dark') return true;
        if (document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark') return true;

        if (document.body && document.body.classList.contains('dark-theme')) return true;
        if (document.documentElement && document.documentElement.classList.contains('dark-theme')) return true;

        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * Generates a full Material Design 3 color palette mapping based on a single seed color and injects
     * the results directly into the document root and body as CSS custom properties, overwriting native styles.
     * @param {string} seedColor - The primary hex color chosen by the user.
     * @param {string} themeMode - The lighting mode context under which the colors should be generated.
     */
    static applyMaterialTheme(seedColor, themeMode) {
        if (!seedColor) return;

        try {
            const isDark = ThemeUtils.isDarkModeActive(themeMode);
            const root = document.documentElement;
            const body = document.body;

            const [h, s] = ThemeUtils.hexToHsl(seedColor);

            const sPrimary = s;
            const sSecondary = Math.min(s * 0.75, 70);
            const sTertiary = Math.min(s * 0.85, 80);
            const sNeutral = Math.min(s * 0.08, 8);
            const sNeutralVariant = Math.min(s * 0.16, 16);
            const hTertiary = (h + 60) % 360;

            const color = (sat, tone) => ThemeUtils.hslToHex(h, sat, tone);
            const colorTertiary = (sat, tone) => ThemeUtils.hslToHex(hTertiary, sat, tone);

            let schemeJson = {};

            if (isDark) {
                schemeJson = {
                    primary: color(sPrimary, 80),
                    onPrimary: color(sPrimary, 20),
                    primaryContainer: color(sPrimary, 30),
                    onPrimaryContainer: color(sPrimary, 90),
                    secondary: color(sSecondary, 80),
                    onSecondary: color(sSecondary, 20),
                    secondaryContainer: color(sSecondary, 30),
                    onSecondaryContainer: color(sSecondary, 90),
                    tertiary: colorTertiary(sTertiary, 80),
                    onTertiary: colorTertiary(sTertiary, 20),
                    tertiaryContainer: colorTertiary(sTertiary, 30),
                    onTertiaryContainer: colorTertiary(sTertiary, 90),
                    background: color(sNeutral, 6),
                    onBackground: color(sNeutral, 90),
                    surface: color(sNeutral, 6),
                    onSurface: color(sNeutral, 90),
                    surfaceVariant: color(sNeutralVariant, 30),
                    onSurfaceVariant: color(sNeutralVariant, 80),
                    outline: color(sNeutralVariant, 60),
                    outlineVariant: color(sNeutralVariant, 30),
                    surfaceContainerLowest: color(sNeutral, 4),
                    surfaceContainerLow: color(sNeutral, 10),
                    surfaceContainer: color(sNeutral, 12),
                    surfaceContainerHigh: color(sNeutral, 17),
                    surfaceContainerHighest: color(sNeutral, 22),
                };
            } else {
                schemeJson = {
                    primary: color(sPrimary, 40),
                    onPrimary: color(sPrimary, 100),
                    primaryContainer: color(sPrimary, 90),
                    onPrimaryContainer: color(sPrimary, 10),
                    secondary: color(sSecondary, 40),
                    onSecondary: color(sSecondary, 100),
                    secondaryContainer: color(sSecondary, 90),
                    onSecondaryContainer: color(sSecondary, 10),
                    tertiary: colorTertiary(sTertiary, 40),
                    onTertiary: colorTertiary(sTertiary, 100),
                    tertiaryContainer: colorTertiary(sTertiary, 90),
                    onTertiaryContainer: colorTertiary(sTertiary, 10),
                    background: color(sNeutral, 99),
                    onBackground: color(sNeutral, 10),
                    surface: color(sNeutral, 99),
                    onSurface: color(sNeutral, 10),
                    surfaceVariant: color(sNeutralVariant, 90),
                    onSurfaceVariant: color(sNeutralVariant, 30),
                    outline: color(sNeutralVariant, 50),
                    outlineVariant: color(sNeutralVariant, 80),
                    surfaceContainerLowest: color(sNeutral, 100),
                    surfaceContainerLow: color(sNeutral, 96),
                    surfaceContainer: color(sNeutral, 94),
                    surfaceContainerHigh: color(sNeutral, 92),
                    surfaceContainerHighest: color(sNeutral, 90),
                };
            }

            const metaThemeColor = document.querySelector("meta[name=theme-color]");
            if (metaThemeColor) {
                metaThemeColor.setAttribute("content", schemeJson.surface);
            }

            for (const [key, value] of Object.entries(schemeJson)) {
                const token = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

                root.style.setProperty(`--bg-sys-color-${token}`, value);
                root.style.setProperty(`--bg-sys-color-${token}-rgb`, ThemeUtils.hexToRgbString(value));

                root.style.setProperty(`--gem-sys-color--${token}`, value, "important");
                root.style.setProperty(`--lumi-sys-color--${token}`, value, "important");
                root.style.setProperty(`--md-sys-color-${token}`, value, "important");
                root.style.setProperty(`--sys-color--${token}`, value, "important");

                if (body) {
                    body.style.setProperty(`--gem-sys-color--${token}`, value, "important");
                    body.style.setProperty(`--lumi-sys-color--${token}`, value, "important");
                    body.style.setProperty(`--md-sys-color-${token}`, value, "important");
                    body.style.setProperty(`--sys-color--${token}`, value, "important");
                }
            }

            if (body) {
                body.style.setProperty("--bard-color-synthetic--chat-window-surface", schemeJson.surface, "important");
                body.style.setProperty("--bard-color-synthetic--mat-card-background", schemeJson.surfaceContainerHigh, "important");
                body.style.setProperty("--bard-color-synthetic--chat-window-surface-container", schemeJson.surfaceContainer, "important");
                body.style.setProperty("--bard-color-synthetic--chat-window-surface-container-high", schemeJson.surfaceContainerHigh, "important");
                body.style.setProperty("--bard-color-synthetic--chat-window-surface-container-highest", schemeJson.surfaceContainerHighest, "important");
                body.style.setProperty("--bard-color-sidenav-background-desktop", schemeJson.surfaceContainerHigh, "important");
                body.style.setProperty("--bard-color-sidenav-background-mobile", schemeJson.surfaceContainerHigh, "important");
            }

            if (themeMode === 'dark') {
                root.classList.add('dark-theme');
                root.classList.remove('light-theme');
                root.style.colorScheme = 'dark';
            } else if (themeMode === 'light') {
                root.classList.add('light-theme');
                root.classList.remove('dark-theme');
                root.style.colorScheme = 'light';
            } else {
                root.style.colorScheme = isDark ? 'dark' : 'light';
            }
        } catch (error) {
        }
    }
}

window.ThemeUtils = ThemeUtils;