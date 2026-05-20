/*
 * Copyright (c) 2026 Fernando Vaz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Constructs and manages a dynamic floating timeline interface that allows users to visually navigate
 * through long conversation threads. It observes the DOM for new message blocks, extracts their context,
 * and builds clickable anchor points that sync with the user's scrolling position.
 */
class TimelineBuilder {
    static timelineObserver = null;
    static isManualScrolling = false;
    static scrollTimeout = null;

    /**
     * Scans the document object model to identify discrete conversational message blocks.
     * It filters out nested elements to ensure only top-level query and response containers are tracked.
     * @returns {Array<HTMLElement>} An array of top-level message container elements.
     */
    static getMessageBlocks() {
        const selectors = 'user-query, model-response, message-row, chunked-message, [data-message-author], [data-test-id*="message"], .response-container';
        const blocks = Array.from(document.querySelectorAll(selectors));
        return blocks.filter(block => !block.parentElement.closest(selectors));
    }

    /**
     * Extracts contextual metadata from a given message block to populate the timeline tooltip.
     * It identifies text content or code snippets, stripping away conversational filler to generate a concise preview.
     * @param {HTMLElement} block - The DOM element representing a single chat message.
     * @returns {Object} An object containing the extracted 'text' preview and an optional 'icon' identifier.
     */
    static getPreviewData(block) {
        let p = block.querySelector('p');
        if (p && p.textContent.trim().length > 0) {
            return {text: CodeUtils.cleanText(p.textContent), icon: null};
        }

        let codeHeader = block.querySelector('.code-block-decoration');
        if (codeHeader) {
            let langSpan = codeHeader.querySelector('.bg-lang-name');
            let language = langSpan ? langSpan.textContent.trim() : '';

            if (!language) {
                let fallbackSpan = codeHeader.querySelector('span:not(.mat-icon)');
                if (fallbackSpan) {
                    language = fallbackSpan.textContent.trim();
                }
            }

            if (language) {
                let previewText = language;
                const codeContainer = block.querySelector('code');
                const codeText = codeContainer ? codeContainer.textContent : '';
                const fileName = CodeUtils.extractCodeMetadata(codeText, language);

                if (fileName) {
                    previewText += ' - ' + fileName;
                } else {
                    previewText += ' Code';
                }

                return {text: previewText, icon: CodeUtils.getLanguageIcon(language)};
            }
        }
        return {text: CodeUtils.cleanText(block.textContent), icon: null};
    }

    /**
     * Generates and injects the core DOM structure for the floating timeline, including scroll containers
     * and directional indicators for hidden items. It also binds scroll event listeners to manage the visibility
     * of off-screen message counters.
     * @returns {HTMLElement} The constructed timeline container element.
     */
    static createTimelineContainer() {
        const container = document.createElement('div');
        container.id = 'better-gemini-timeline';

        const topCounter = document.createElement('div');
        topCounter.id = 'bg-timeline-counter-top';
        topCounter.className = 'bg-timeline-counter';
        container.appendChild(topCounter);

        const itemsContainer = document.createElement('div');
        itemsContainer.id = 'bg-timeline-items';

        const line = document.createElement('div');
        line.className = 'bg-timeline-line';
        itemsContainer.appendChild(line);

        container.appendChild(itemsContainer);

        const bottomCounter = document.createElement('div');
        bottomCounter.id = 'bg-timeline-counter-bottom';
        bottomCounter.className = 'bg-timeline-counter';
        container.appendChild(bottomCounter);

        document.body.appendChild(container);

        let localScrollTimer = null;
        let lastScrollTop = 0;

        container.addEventListener('scroll', () => {
            const st = container.scrollTop;
            const direction = st > lastScrollTop ? 'down' : 'up';
            lastScrollTop = st <= 0 ? 0 : st;

            const items = container.querySelectorAll('.timeline-item');
            const total = items.length;
            if (total === 0) return;

            let hiddenAbove = 0;
            let hiddenBelow = 0;
            const containerRect = container.getBoundingClientRect();
            const topBoundary = containerRect.top + 24;
            const bottomBoundary = containerRect.bottom - 24;

            items.forEach(item => {
                const rect = item.getBoundingClientRect();
                if (rect.bottom < topBoundary) {
                    hiddenAbove++;
                } else if (rect.top > bottomBoundary) {
                    hiddenBelow++;
                }
            });

            if (direction === 'up' && hiddenAbove > 0) {
                topCounter.textContent = `↑ +${hiddenAbove}`;
                topCounter.classList.add('visible');
                bottomCounter.classList.remove('visible');
            } else if (direction === 'down' && hiddenBelow > 0) {
                bottomCounter.textContent = `↓ +${hiddenBelow}`;
                bottomCounter.classList.add('visible');
                topCounter.classList.remove('visible');
            } else {
                topCounter.classList.remove('visible');
                bottomCounter.classList.remove('visible');
            }

            clearTimeout(localScrollTimer);
            localScrollTimer = setTimeout(() => {
                topCounter.classList.remove('visible');
                bottomCounter.classList.remove('visible');
            }, 800);
        }, {passive: true});

        window.addEventListener('scroll', () => {
            const tooltip = document.getElementById('bg-global-tooltip');
            if (tooltip) {
                tooltip.classList.remove('visible');
            }
        }, {passive: true, capture: true});

        return container;
    }

    /**
     * Provisions a reusable, globally positioned tooltip element used to display message previews
     * when the user hovers over individual timeline nodes.
     * @returns {HTMLElement} The global tooltip DOM node.
     */
    static createGlobalTooltip() {
        let tooltip = document.getElementById('bg-global-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'bg-global-tooltip';
            tooltip.className = 'timeline-global-tooltip';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'google-symbols timeline-icon';
            iconSpan.id = 'bg-global-tooltip-icon';

            const textSpan = document.createElement('span');
            textSpan.className = 'timeline-text';
            textSpan.id = 'bg-global-tooltip-text';

            tooltip.appendChild(iconSpan);
            tooltip.appendChild(textSpan);
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    /**
     * Drives the core logic of the timeline system. It evaluates the current chat state, registers new
     * message blocks with an IntersectionObserver to track viewport visibility, creates graphical nodes
     * based on content type, and manages programmatic scrolling when a timeline node is clicked.
     */
    static update() {
        const container = document.getElementById('better-gemini-timeline') || this.createTimelineContainer();
        const itemsContainer = document.getElementById('bg-timeline-items');

        const globalTooltip = this.createGlobalTooltip();
        const tooltipIcon = document.getElementById('bg-global-tooltip-icon');
        const tooltipText = document.getElementById('bg-global-tooltip-text');

        const dialogBlocks = this.getMessageBlocks();
        let processedCount = 0;
        const activeBlockIds = [];

        if (!this.timelineObserver) {
            this.timelineObserver = new IntersectionObserver((entries) => {
                if (this.isManualScrolling) return;

                const blocks = this.getMessageBlocks();
                let activeBlock = null;

                for (let i = 0; i < blocks.length; i++) {
                    const rect = blocks[i].getBoundingClientRect();
                    if (rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.2) {
                        activeBlock = blocks[i];
                        break;
                    }
                }

                if (activeBlock) {
                    const targetId = activeBlock.getAttribute('data-bg-id');
                    const activeLink = document.getElementById('timeline-link-' + targetId);
                    if (activeLink && !activeLink.classList.contains('active')) {
                        document.querySelectorAll('.timeline-item.active').forEach(el => el.classList.remove('active'));
                        activeLink.classList.add('active');

                        const timelineContainer = document.getElementById('better-gemini-timeline');
                        if (timelineContainer) {
                            const linkTop = activeLink.offsetTop;
                            const containerHalfHeight = timelineContainer.clientHeight / 2;
                            timelineContainer.scrollTo({
                                top: linkTop - containerHalfHeight,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }, {threshold: [0, 0.1, 0.5, 0.9]});
        }

        dialogBlocks.forEach((block) => {
            const textContent = CodeUtils.cleanText(block.textContent);
            if (textContent.length === 0) return;

            processedCount++;

            if (!block.hasAttribute('data-bg-id')) {
                const uniqueId = 'bg-block-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000000).toString();
                block.setAttribute('data-bg-id', uniqueId);
                this.timelineObserver.observe(block);
            }

            const blockId = block.getAttribute('data-bg-id');
            activeBlockIds.push(blockId);

            let link = document.getElementById('timeline-link-' + blockId);

            const isUser = block.tagName.toLowerCase() === 'user-query' ||
                block.tagName.toLowerCase() === 'user-message' ||
                block.getAttribute('data-message-author') === 'user' ||
                block.getAttribute('data-test-id') === 'user-message' ||
                (block.className && typeof block.className === 'string' && block.className.includes('user')) ||
                block.querySelector('[data-test-id="user-message"]') !== null;

            const hasCode = block.querySelector('code-block') !== null || block.querySelector('pre') !== null;
            const defaultText = isUser ? LocaleManager.getString('userPrompt') : LocaleManager.getString('geminiResponse');

            if (!link) {
                link = document.createElement('a');
                link.href = '#';
                link.className = 'timeline-item ' + (isUser ? 'user' : 'gemini');
                link.id = 'timeline-link-' + blockId;

                const dot = document.createElement('div');
                dot.className = 'bg-timeline-dot';

                let shapeName = 'pill.svg';
                if (isUser) {
                    shapeName = 'cookie.svg';
                } else if (hasCode) {
                    shapeName = 'triangle.svg';
                }

                try {
                    const shapeUrl = chrome.runtime.getURL('assets/shapes/' + shapeName);
                    dot.style.webkitMaskImage = 'url(' + shapeUrl + ')';
                    dot.style.maskImage = 'url(' + shapeUrl + ')';
                } catch (e) {
                }

                link.appendChild(dot);

                link.addEventListener('mouseenter', () => {
                    const rect = link.getBoundingClientRect();
                    const currentBlock = document.querySelector('[data-bg-id="' + blockId + '"]');
                    let previewData = {text: '', icon: null};

                    if (currentBlock) {
                        previewData = this.getPreviewData(currentBlock);
                    }

                    tooltipIcon.textContent = previewData.icon || (isUser ? 'person' : 'smart_toy');
                    tooltipText.textContent = previewData.text || defaultText;

                    globalTooltip.style.top = (rect.top + rect.height / 2) + 'px';
                    globalTooltip.style.right = (window.innerWidth - rect.left + 12) + 'px';
                    globalTooltip.classList.add('visible');
                });

                link.addEventListener('mouseleave', () => {
                    globalTooltip.classList.remove('visible');
                });

                link.onclick = (e) => {
                    e.preventDefault();
                    this.isManualScrolling = true;
                    clearTimeout(this.scrollTimeout);

                    document.querySelectorAll('.timeline-item.active').forEach(el => el.classList.remove('active'));
                    link.classList.add('active');

                    const timelineContainer = document.getElementById('better-gemini-timeline');
                    if (timelineContainer) {
                        const linkTop = link.offsetTop;
                        const containerHalfHeight = timelineContainer.clientHeight / 2;
                        timelineContainer.scrollTo({
                            top: linkTop - containerHalfHeight,
                            behavior: 'smooth'
                        });
                    }

                    const targetBlock = document.querySelector('[data-bg-id="' + blockId + '"]') || block;
                    const scrollTarget = targetBlock.closest('message-row') || targetBlock.closest('.message-row') || targetBlock;

                    scrollTarget.style.scrollMarginTop = '80px';
                    scrollTarget.scrollIntoView({behavior: 'smooth', block: 'start'});

                    globalTooltip.classList.remove('visible');

                    this.scrollTimeout = setTimeout(() => {
                        this.isManualScrolling = false;
                    }, 1200);
                };

                itemsContainer.appendChild(link);
            }
        });

        const existingLinks = itemsContainer.querySelectorAll('.timeline-item');
        existingLinks.forEach(link => {
            const linkId = link.id.replace('timeline-link-', '');
            if (activeBlockIds.indexOf(linkId) === -1) {
                link.remove();
            }
        });

        if (processedCount === 0) {
            container.style.display = 'none';
            globalTooltip.classList.remove('visible');
        } else {
            container.style.display = 'flex';
        }
    }
}

window.TimelineBuilder = TimelineBuilder;