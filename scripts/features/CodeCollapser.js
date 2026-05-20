/*
 * Copyright (c) 2026 Fernando Vaz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Scans the DOM for preformatted code blocks and injects interactive buttons that allow users
 * to toggle their visibility (collapse/expand). It manages scroll anchoring to maintain the
 * user's viewport position during layout shifts and provides navigational controls between blocks.
 */
class CodeCollapser {
    /**
     * Resolves the fully qualified URL for internal extension assets to prevent
     * Content Security Policy (CSP) violations when injecting images into the host page.
     * @param {string} path - The relative path to the asset within the extension package.
     * @returns {string} The CSS-ready URL string, or 'none' if unavailable.
     */
    static getSafeUrl(path) {
        try {
            if (chrome && chrome.runtime && chrome.runtime.id) {
                return `url(${chrome.runtime.getURL(path)})`;
            }
            return 'none';
        } catch (e) {
            return 'none';
        }
    }

    /**
     * Iterates over unprocessed code blocks in the document. It locates the appropriate header
     * container, injects a custom collapse button, handles the click event to toggle CSS heights,
     * and injects directional navigation buttons to jump between neighboring code blocks.
     */
    static process() {
        const blocks = document.querySelectorAll('pre');
        blocks.forEach(block => {
            if (!block.classList.contains('bg-processed')) {
                block.classList.add('bg-processed');

                let header = null;
                const container = block.closest('code-block') || block.closest('.code-block') || block.parentElement?.parentElement;

                if (container) {
                    header = container.querySelector('.code-block-decoration.header-formatted, .code-block-header, [data-test-id="code-block-header"], .header-formatted');
                    if (window.getComputedStyle(container).position === 'static') {
                        container.style.position = 'relative';
                    }
                }

                if (!header && block.previousElementSibling && (block.previousElementSibling.classList.contains('code-block-decoration') || block.previousElementSibling.classList.contains('code-block-header') || block.previousElementSibling.classList.contains('header-formatted'))) {
                    header = block.previousElementSibling;
                    if (block.parentElement && window.getComputedStyle(block.parentElement).position === 'static') {
                        block.parentElement.style.position = 'relative';
                    }
                }

                if (header) {
                    let buttonsArea = header.querySelector('.buttons, .action-buttons');
                    if (!buttonsArea) {
                        buttonsArea = document.createElement('div');
                        buttonsArea.className = 'buttons';
                        buttonsArea.style.display = 'flex';
                        buttonsArea.style.alignItems = 'center';
                        header.appendChild(buttonsArea);
                    }

                    let btn;
                    const existingBtn = buttonsArea.querySelector('button.mdc-icon-button, button.mat-mdc-icon-button');

                    if (existingBtn) {
                        btn = existingBtn.cloneNode(true);
                        btn.classList.add('bg-collapse-icon-btn');
                        btn.classList.remove('download-button');

                        btn.removeAttribute('data-test-id');
                        btn.removeAttribute('mattooltip');
                        btn.removeAttribute('title');
                        btn.removeAttribute('jslog');
                        btn.removeAttribute('aria-describedby');
                        btn.removeAttribute('cdk-describedby-host');

                        const existingIcons = btn.querySelectorAll('mat-icon, .google-symbols, svg, img');
                        existingIcons.forEach(i => i.remove());
                    } else {
                        btn = document.createElement('button');
                        btn.className = 'mdc-icon-button mat-mdc-icon-button bg-collapse-icon-btn';
                        const touchTarget = document.createElement('span');
                        touchTarget.className = 'mat-mdc-button-touch-target';
                        btn.appendChild(touchTarget);
                    }

                    btn.setAttribute('aria-label', typeof window.LocaleManager !== 'undefined' ? window.LocaleManager.getString('collapseCode') : 'Collapse');

                    const icon = document.createElement('span');
                    icon.className = 'bg-collapse-svg-icon';
                    icon.style.setProperty('--bg-icon-url', CodeCollapser.getSafeUrl('assets/icons/expanded.svg'));
                    btn.appendChild(icon);

                    const tooltip = document.createElement('div');
                    tooltip.className = 'bg-custom-tooltip';
                    tooltip.textContent = typeof window.LocaleManager !== 'undefined' ? window.LocaleManager.getString('collapseCode') : 'Collapse';
                    btn.appendChild(tooltip);

                    btn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const getScrollParent = (node) => {
                            if (node == null || node === document.body || node === document.documentElement) return null;
                            if (node.scrollHeight > node.clientHeight) {
                                const overflowY = window.getComputedStyle(node).overflowY;
                                if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node;
                            }
                            return getScrollParent(node.parentNode);
                        };

                        const anchor = header || block;
                        const scrollParent = getScrollParent(anchor);
                        const beforeRect = anchor.getBoundingClientRect();

                        const isCollapsed = block.classList.toggle('bg-collapsed');
                        if (header) {
                            header.classList.toggle('bg-header-collapsed', isCollapsed);
                        }

                        const afterRect = anchor.getBoundingClientRect();
                        const diff = afterRect.top - beforeRect.top;

                        if (diff !== 0) {
                            if (scrollParent) {
                                scrollParent.scrollTop += diff;
                            } else {
                                window.scrollBy(0, diff);
                            }
                        }

                        if (document.body.classList.contains('bg-auto-center-enabled')) {
                            setTimeout(() => {
                                anchor.scrollIntoView({behavior: 'smooth', block: 'center'});
                            }, 50);
                        }

                        const targetIcon = isCollapsed ? 'assets/icons/collapsed.svg' : 'assets/icons/expanded.svg';
                        icon.style.setProperty('--bg-icon-url', CodeCollapser.getSafeUrl(targetIcon));

                        const newText = isCollapsed ?
                            (typeof window.LocaleManager !== 'undefined' ? window.LocaleManager.getString('expandCode') : 'Expand') :
                            (typeof window.LocaleManager !== 'undefined' ? window.LocaleManager.getString('collapseCode') : 'Collapse');

                        tooltip.textContent = newText;
                        btn.setAttribute('aria-label', newText);
                    };

                    buttonsArea.insertBefore(btn, buttonsArea.firstChild);
                }

                const navDiv = document.createElement('div');
                navDiv.className = 'bg-code-nav';

                const upBtn = document.createElement('button');
                upBtn.className = 'bg-code-nav-btn';

                const upTooltip = document.createElement('div');
                upTooltip.className = 'bg-custom-tooltip';
                upTooltip.textContent = "Previous code block";
                upBtn.appendChild(upTooltip);

                const upIcon = document.createElement('span');
                upIcon.className = 'google-symbols';
                upIcon.textContent = 'keyboard_arrow_up';
                upBtn.appendChild(upIcon);

                const downBtn = document.createElement('button');
                downBtn.className = 'bg-code-nav-btn';

                const downTooltip = document.createElement('div');
                downTooltip.className = 'bg-custom-tooltip';
                downTooltip.textContent = "Next code block";
                downBtn.appendChild(downTooltip);

                const downIcon = document.createElement('span');
                downIcon.className = 'google-symbols';
                downIcon.textContent = 'keyboard_arrow_down';
                downBtn.appendChild(downIcon);

                upBtn.onclick = (e) => {
                    e.preventDefault();
                    const allProcessed = Array.from(document.querySelectorAll('pre.bg-processed'));
                    const currentIndex = allProcessed.indexOf(block);
                    if (currentIndex > 0) {
                        const target = allProcessed[currentIndex - 1];
                        const targetContainer = target.closest('code-block') || target;
                        targetContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
                    }
                };

                downBtn.onclick = (e) => {
                    e.preventDefault();
                    const allProcessed = Array.from(document.querySelectorAll('pre.bg-processed'));
                    const currentIndex = allProcessed.indexOf(block);
                    if (currentIndex < allProcessed.length - 1) {
                        const target = allProcessed[currentIndex + 1];
                        const targetContainer = target.closest('code-block') || target;
                        targetContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
                    }
                };

                navDiv.appendChild(upBtn);
                navDiv.appendChild(downBtn);

                if (block.nextSibling) {
                    block.parentNode.insertBefore(navDiv, block.nextSibling);
                } else {
                    block.parentNode.appendChild(navDiv);
                }
            }
        });
    }
}

window.CodeCollapser = CodeCollapser;