/*
 * Copyright (c) 2026 Fernando Vaz
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Listens for specific keystroke patterns within active text editors to trigger a contextual
 * dropdown menu. It allows users to quickly select and insert predefined text snippets natively,
 * preserving existing formatting and editor state.
 */
class SnippetInjector {
    /**
     * Holds the active session state of the snippet overlay, keeping track of visibility,
     * matched search results, keyboard navigation index, and the exact text node being edited.
     */
    static state = {
        isOpen: false,
        query: '',
        matches: [],
        activeIndex: 0,
        node: null,
        startOffset: 0,
        endOffset: 0
    };

    /**
     * Cache for the global extension settings, used to determine the activation prefix
     * and access the list of user-defined snippets.
     */
    static settingsRef = null;

    /**
     * Initializes the snippet engine by binding global event listeners to intercept
     * typing, navigation keystrokes, and out-of-bounds mouse clicks.
     * @param {Object} settings - Reference to the global extension settings state.
     */
    static init(settings) {
        this.settingsRef = settings;
        document.addEventListener('keydown', (e) => this.handleKeydown(e), true);
        document.addEventListener('keyup', (e) => this.handleKeyup(e), true);
        document.addEventListener('mousedown', (e) => this.handleClick(e), true);
    }

    /**
     * Hides the snippet overlay and purges the current matching results from the active state.
     */
    static closeMenu() {
        this.state.isOpen = false;
        this.state.matches = [];
        const menu = document.getElementById('bg-snippet-menu');
        if (menu) {
            menu.classList.remove('visible');
        }
    }

    /**
     * Replaces the user's typed trigger keyword with the full snippet content. It uses
     * the native Document.execCommand API to ensure compatibility with rich text editors
     * and manually dispatches an input event to notify frameworks of the change.
     * @param {Object} snippet - The selected snippet data object to be inserted.
     */
    static insertSnippet(snippet) {
        if (!this.state.node) return;

        const isTextarea = this.state.node.tagName && this.state.node.tagName.toLowerCase() === 'textarea';

        if (isTextarea) {
            const textarea = this.state.node;
            const text = textarea.value;
            const before = text.substring(0, this.state.startOffset);
            const after = text.substring(this.state.endOffset);
            
            textarea.value = before + snippet.content + after;
            textarea.dispatchEvent(new Event('input', {bubbles: true}));
            textarea.dispatchEvent(new Event('change', {bubbles: true}));
            
            const newCursorPos = this.state.startOffset + snippet.content.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        } else {
            const range = document.createRange();
            range.setStart(this.state.node, this.state.startOffset);
            range.setEnd(this.state.node, this.state.endOffset);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            document.execCommand('insertText', false, snippet.content);

            const targetEditor = this.state.node.parentElement ? this.state.node.parentElement.closest('.ql-editor') : null;
            if (targetEditor) {
                targetEditor.dispatchEvent(new Event('input', {bubbles: true}));
            }
        }

        this.closeMenu();
    }

    /**
     * Dynamically generates and positions the DOM elements for the popup menu based on
     * the current search state. Calculates available viewport space to decide whether to
     * render the menu above or below the active input field.
     */
    static renderMenu() {
        let menu = document.getElementById('bg-snippet-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'bg-snippet-menu';
            document.body.appendChild(menu);
        }

        menu.textContent = '';

        const header = document.createElement('div');
        header.className = 'bg-snippet-menu-header';

        const headerIcon = document.createElement('span');
        headerIcon.className = 'google-symbols';
        headerIcon.textContent = 'bolt';

        const headerText = document.createElement('span');
        headerText.textContent = LocaleManager.getString('snippetsTitle');

        header.appendChild(headerIcon);
        header.appendChild(headerText);
        menu.appendChild(header);

        if (this.state.matches.length === 0) {
            const emptyContainer = document.createElement('div');
            emptyContainer.className = 'bg-snippet-empty';

            const emptyText = document.createElement('span');
            emptyText.className = 'bg-snippet-empty-text';
            emptyText.textContent = LocaleManager.getString('snippetDropdownEmpty');

            const addBtn = document.createElement('button');
            addBtn.className = 'bg-snippet-add-btn';
            if (this.state.activeIndex === 0) {
                addBtn.classList.add('active');
            }

            const addIcon = document.createElement('span');
            addIcon.className = 'google-symbols';
            addIcon.textContent = 'add';
            addIcon.style.fontSize = '18px';

            const addText = document.createElement('span');
            addText.textContent = LocaleManager.getString('snippetDropdownAdd');

            addBtn.appendChild(addIcon);
            addBtn.appendChild(addText);

            addBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeMenu();
                chrome.runtime.sendMessage({action: 'openSnippets'});
            });

            addBtn.addEventListener('mouseenter', () => {
                this.state.activeIndex = 0;
                const allItems = menu.querySelectorAll('.bg-snippet-add-btn');
                allItems.forEach(i => i.classList.remove('active'));
                addBtn.classList.add('active');
            });

            emptyContainer.appendChild(emptyText);
            emptyContainer.appendChild(addBtn);
            menu.appendChild(emptyContainer);
        } else {
            this.state.matches.forEach((snippet, index) => {
                const item = document.createElement('button');
                item.className = 'bg-snippet-menu-item';
                if (index === this.state.activeIndex) {
                    item.classList.add('active');
                }

                const iconContainer = document.createElement('div');
                iconContainer.className = 'bg-snippet-icon-container';
                const icon = document.createElement('span');
                icon.className = 'google-symbols';
                icon.textContent = 'edit_note';
                iconContainer.appendChild(icon);

                const textContainer = document.createElement('div');
                textContainer.className = 'bg-snippet-text-container';

                const keywordNode = document.createElement('span');
                keywordNode.className = 'bg-snippet-keyword';
                const cleanKw = snippet.keyword.replace(/^[/*!#@]+/, '');
                keywordNode.textContent = this.settingsRef.snippetPrefix + cleanKw;

                const previewNode = document.createElement('span');
                previewNode.className = 'bg-snippet-preview';
                previewNode.textContent = snippet.content;

                textContainer.appendChild(keywordNode);
                textContainer.appendChild(previewNode);

                item.appendChild(iconContainer);
                item.appendChild(textContainer);

                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertSnippet(snippet);
                });

                item.addEventListener('mouseenter', () => {
                    this.state.activeIndex = index;
                    const allItems = menu.querySelectorAll('.bg-snippet-menu-item');
                    allItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                });

                menu.appendChild(item);
            });
        }

        menu.classList.add('visible');

        let inputContainer = null;
        if (this.state.node && this.state.node.parentElement) {
            inputContainer = this.state.node.parentElement.closest('.text-input-field, .input-area-v2, textarea');
        }
        if (!inputContainer) {
            inputContainer = document.querySelector('.text-input-field, .input-area-v2, textarea');
        }

        if (inputContainer) {
            const rect = inputContainer.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.left = `${rect.left + 24}px`;
            menu.style.zIndex = '2147483647';

            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;

            if (spaceAbove < 200 && spaceBelow > spaceAbove) {
                menu.style.bottom = 'auto';
                menu.style.top = `${rect.bottom + 8}px`;
                menu.style.maxHeight = `${Math.min(Math.max(spaceBelow - 24, 150), 360)}px`;
            } else {
                menu.style.top = 'auto';
                menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                menu.style.maxHeight = `${Math.min(Math.max(spaceAbove - 24, 150), 360)}px`;
            }
        }

        const activeItem = menu.querySelector('.bg-snippet-menu-item.active, .bg-snippet-add-btn.active');
        if (activeItem) {
            const maxIndex = this.state.matches.length > 0 ? this.state.matches.length : 1;

            if (this.state.activeIndex === 0) {
                menu.scrollTop = 0;
            } else if (this.state.activeIndex === maxIndex - 1) {
                menu.scrollTop = menu.scrollHeight;
            } else {
                activeItem.scrollIntoView({block: 'nearest'});
            }
        }
    }

    /**
     * Updates the internal state variables to prepare the menu for display and triggers the render cycle.
     * @param {string} query - The exact text typed by the user including the activation prefix.
     * @param {Array} matches - Filtered array of snippet objects matching the query.
     * @param {Node} node - The DOM text node containing the user's cursor.
     * @param {number} startOffset - The starting character index of the query within the text node.
     * @param {number} endOffset - The ending character index of the query within the text node.
     */
    static openMenu(query, matches, node, startOffset, endOffset) {
        this.state.isOpen = true;
        this.state.query = query;
        this.state.matches = matches;
        this.state.activeIndex = 0;
        this.state.node = node;
        this.state.startOffset = startOffset;
        this.state.endOffset = endOffset;
        this.renderMenu();
    }

    /**
     * Evaluates the current text selection and string immediately preceding the cursor
     * to determine if it matches the configured activation prefix and triggers the menu.
     */
    static checkTrigger() {
        const activeEl = document.activeElement;
        const isTextarea = activeEl && activeEl.tagName && activeEl.tagName.toLowerCase() === 'textarea';

        if (isTextarea) {
            const text = activeEl.value;
            const offset = activeEl.selectionStart;
            if (offset !== activeEl.selectionEnd) {
                this.closeMenu();
                return;
            }
            const textBeforeCursor = text.substring(0, offset);

            const safePrefix = this.settingsRef.snippetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('(?:^|\\s)(' + safePrefix + '([\\w-]*))$');
            const match = textBeforeCursor.match(regex);

            if (match) {
                const fullTypedText = match[1];
                const searchWord = match[2].toLowerCase();

                let matches = [];
                if (this.settingsRef.snippets && Array.isArray(this.settingsRef.snippets)) {
                    matches = this.settingsRef.snippets.filter(s => {
                        const cleanKw = s.keyword.replace(/^[/*!#@]+/, '').toLowerCase();
                        return cleanKw.startsWith(searchWord);
                    }).slice(0, 5);
                }

                const startOffset = offset - fullTypedText.length;
                this.openMenu(fullTypedText, matches, activeEl, startOffset, offset);
            } else {
                this.closeMenu();
            }
            return;
        }

        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            this.closeMenu();
            return;
        }

        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            this.closeMenu();
            return;
        }

        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) {
            this.closeMenu();
            return;
        }

        const editor = node.parentElement ? node.parentElement.closest('.ql-editor') : null;
        if (!editor) {
            this.closeMenu();
            return;
        }

        const text = node.textContent;
        const offset = range.startOffset;
        const textBeforeCursor = text.substring(0, offset);

        const safePrefix = this.settingsRef.snippetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('(?:^|\\s)(' + safePrefix + '([\\w-]*))$');
        const match = textBeforeCursor.match(regex);

        if (match) {
            const fullTypedText = match[1];
            const searchWord = match[2].toLowerCase();

            let matches = [];
            if (this.settingsRef.snippets && Array.isArray(this.settingsRef.snippets)) {
                matches = this.settingsRef.snippets.filter(s => {
                    const cleanKw = s.keyword.replace(/^[/*!#@]+/, '').toLowerCase();
                    return cleanKw.startsWith(searchWord);
                }).slice(0, 5);
            }

            const startOffset = offset - fullTypedText.length;
            this.openMenu(fullTypedText, matches, node, startOffset, offset);
        } else {
            this.closeMenu();
        }
    }

    /**
     * Intercepts keydown events when the menu is active to allow keyboard navigation
     * (up/down arrows) and selection confirmation (enter/tab) without affecting the underlying text.
     * @param {KeyboardEvent} event - The keyboard event passed by the global listener.
     */
    static handleKeydown(event) {
        if (!this.state.isOpen) return;

        const maxIndex = this.state.matches.length > 0 ? this.state.matches.length : 1;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            this.state.activeIndex = (this.state.activeIndex + 1) % maxIndex;
            this.renderMenu();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            this.state.activeIndex = (this.state.activeIndex - 1 + maxIndex) % maxIndex;
            this.renderMenu();
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            if (this.state.matches.length === 0) {
                this.closeMenu();
                chrome.runtime.sendMessage({action: 'openSnippets'});
            } else {
                this.insertSnippet(this.state.matches[this.state.activeIndex]);
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.closeMenu();
        }
    }

    /**
     * Fires after a keystroke is completed to re-evaluate the text context and determine
     * if the dropdown should be opened, updated, or closed based on the new cursor position.
     * @param {KeyboardEvent} event - The keyup event passed by the global listener.
     */
    static handleKeyup(event) {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
            return;
        }
        this.checkTrigger();
    }

    /**
     * Detects mouse clicks outside the boundaries of the snippet menu overlay
     * and forces the menu to close, restoring normal UI interaction.
     * @param {MouseEvent} event - The mouse click event passed by the global listener.
     */
    static handleClick(event) {
        const menu = document.getElementById('bg-snippet-menu');
        if (menu && !menu.contains(event.target)) {
            this.closeMenu();
        }
    }
}

window.SnippetInjector = SnippetInjector;