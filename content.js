// content.js - v15 (Streaming Support)

// === Biến toàn cục ===
let translateIcon = null;         // Icon dịch bôi đen (thay cho nút G)
let hoverBox = null;                // Box kết quả G
let currentSelection = null;        // Selection hiện tại
let imageTranslateBox = null;       // Box kết quả dịch ảnh

// === Biến toàn cục cho Dịch Toàn Trang (In-Place Translation Engine) ===
let pageTranslationActive = false;
let pageBlockMap = new Map(); // id -> { element, originalHTML, hasChildTags }
let statusBar = null;
let pageTranslatedCount = 0;
let pageTotalBlocks = 0;
let blockIdCounter = 0;
let pageTargetLang = 'vietnamese';

// Helper to check if extension context is alive and valid
function isExtensionValid() {
    try {
        return typeof chrome !== 'undefined' && 
               Boolean(chrome?.runtime?.id) && 
               typeof chrome?.runtime?.connect === 'function';
    } catch (_) {
        return false;
    }
}

// === Hàm Khởi tạo ===
function initialize() {
    addEscKeyListener();
}

// === Hàm quản lý UI dịch bôi đen ===
function showTranslateIcon(x, y, text) {
    removeTranslateIcon();
    removeHoverBox();

    // currentSelection = selection; // We don't strictly need the selection object anymore if we have the text
    // But handleTranslateIconClick might rely on it? No, it uses dataset.

    translateIcon = document.createElement('div');
    translateIcon.id = 'hypertranslator-highlight-icon';
    translateIcon.title = 'Translate / Summarize selected text';
    translateIcon.style.left = `${x}px`;
    translateIcon.style.top = `${y}px`;

    // Store the cleaned text
    translateIcon.dataset.selectedText = text;

    translateIcon.style.position = 'absolute';
    translateIcon.style.zIndex = '2147483646';

    // Main icon keeps old behavior (click = translate)
    translateIcon.addEventListener('click', handleTranslateIconClick);

    // Keep mini actions open while the user moves the cursor
    let hideMiniTimer = null;
    const openMini = () => {
        if (!translateIcon) return;
        if (hideMiniTimer) clearTimeout(hideMiniTimer);
        translateIcon.classList.add('ht-mini-open');
    };
    const scheduleCloseMini = () => {
        if (!translateIcon) return;
        if (hideMiniTimer) clearTimeout(hideMiniTimer);
        hideMiniTimer = setTimeout(() => {
            translateIcon?.classList?.remove('ht-mini-open');
        }, 400);
    };

    translateIcon.addEventListener('mouseenter', openMini);
    translateIcon.addEventListener('mouseleave', scheduleCloseMini);

    // Mini actions shown on hover
    const miniActions = document.createElement('div');
    miniActions.className = 'ht-mini-actions';

    const miniTranslateBtn = document.createElement('button');
    miniTranslateBtn.type = 'button';
    miniTranslateBtn.className = 'ht-mini-btn ht-mini-translate';
    miniTranslateBtn.title = 'Translate';
    miniTranslateBtn.addEventListener('click', handleTranslateIconClick);
    miniTranslateBtn.addEventListener('mouseenter', openMini);
    miniTranslateBtn.addEventListener('mouseleave', scheduleCloseMini);

    const miniSummarizeBtn = document.createElement('button');
    miniSummarizeBtn.type = 'button';
    miniSummarizeBtn.className = 'ht-mini-btn ht-mini-summarize';
    miniSummarizeBtn.title = 'Summarize';
    miniSummarizeBtn.addEventListener('click', handleSummarizeIconClick);
    miniSummarizeBtn.addEventListener('mouseenter', openMini);
    miniSummarizeBtn.addEventListener('mouseleave', scheduleCloseMini);

    miniActions.appendChild(miniTranslateBtn);
    miniActions.appendChild(miniSummarizeBtn);
    translateIcon.appendChild(miniActions);

    document.body.appendChild(translateIcon);
}

function showHoverBox(x, y, content, isLoading = false) {
    let isNewBox = false;
    if (!hoverBox) {
        isNewBox = true;
        hoverBox = document.createElement('div');
        hoverBox.id = 'text-translate-hover-box';
        hoverBox.style.position = 'absolute';
        hoverBox.style.zIndex = '2147483645';
        document.body.appendChild(hoverBox);
        // Allow moving the box (left-drag on the box background).
        makeDraggable(hoverBox, { button: 0, requireDirectTarget: false });
    } else {
        hoverBox.style.display = '';
    }

    if (isLoading) {
        hoverBox.innerHTML = ''; // Clear content
        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'loading';
        for (let i = 0; i < 5; i++) { loaderDiv.appendChild(document.createElement('span')); }
        hoverBox.appendChild(loaderDiv);
    } else {
        // Only clear if it was loading or empty, otherwise we might be appending
        // But for simplicity, we usually replace content unless streaming
        // For streaming, we will handle content updates separately or pass full content here
        let contentParagraph = hoverBox.querySelector('p');
        if (!contentParagraph) {
            hoverBox.innerHTML = '';
            contentParagraph = document.createElement('p');
            hoverBox.appendChild(contentParagraph);
        }
        contentParagraph.textContent = content || 'No translation result.';
    }

    // --- Positioning logic ---
    // If user has moved the box, keep its position while streaming/updating content.
    if (!hoverBox.dataset.moved && !hoverBox.dataset.positioned) {
        const boxRect = hoverBox.getBoundingClientRect();
        const pos = calculateSmartPosition(x, y, boxRect.width || 250, boxRect.height || 60);
        hoverBox.style.left = `${pos.left}px`;
        hoverBox.style.top = `${pos.top}px`;
        hoverBox.dataset.positioned = "true";
    }
}

function showImageTranslateBox(x, y, content, isLoading = false) {
    if (!imageTranslateBox) {
        imageTranslateBox = document.createElement('div');
        imageTranslateBox.id = 'image-translate-hover-box';
        imageTranslateBox.style.position = 'absolute';
        imageTranslateBox.style.zIndex = '2147483645';
        document.body.appendChild(imageTranslateBox);
        makeDraggable(imageTranslateBox, { button: 0, requireDirectTarget: false });
    } else {
        imageTranslateBox.style.display = '';
    }

    if (isLoading) {
        imageTranslateBox.innerHTML = '';
        const loaderDiv = document.createElement('div');
        loaderDiv.className = 'loading';
        for (let i = 0; i < 5; i++) { loaderDiv.appendChild(document.createElement('span')); }
        imageTranslateBox.appendChild(loaderDiv);
    } else {
        let contentParagraph = imageTranslateBox.querySelector('p');
        if (!contentParagraph) {
            imageTranslateBox.innerHTML = '';
            contentParagraph = document.createElement('p');
            imageTranslateBox.appendChild(contentParagraph);
        }
        contentParagraph.textContent = content || 'No translation result.';
    }

    // --- Positioning logic ---
    if (!imageTranslateBox.dataset.moved && !imageTranslateBox.dataset.positioned) {
        const boxRect = imageTranslateBox.getBoundingClientRect();
        const pos = calculateSmartPosition(x, y, boxRect.width || 250, boxRect.height || 60);
        imageTranslateBox.style.left = `${pos.left}px`;
        imageTranslateBox.style.top = `${pos.top}px`;
        imageTranslateBox.dataset.positioned = "true";
    }
}

// === Helper Functions ===

function calculateSmartPosition(x, y, width, height) {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default to placing below
    let finalY = y;

    const spaceBelow = viewportHeight + scrollY - 10 - y;
    const spaceAbove = y - (scrollY + 10);

    // If it doesn't fit below, but fits above, move it above
    if (height > spaceBelow && height <= spaceAbove) {
        finalY = y - height - 5;
    }

    // Vertical boundary checks
    if (finalY < scrollY + 10) {
        finalY = scrollY + 10;
    }
    if (finalY + height > viewportHeight + scrollY - 10) {
        finalY = viewportHeight + scrollY - height - 10;
        // If it still overflows top after clamping to bottom, clamp to top again
        if (finalY < scrollY + 10) finalY = scrollY + 10;
    }

    // Horizontal boundary checks
    let finalX = x;
    if (finalX + width > viewportWidth + scrollX - 10) {
        finalX = viewportWidth + scrollX - width - 10;
    }
    if (finalX < scrollX + 10) {
        finalX = scrollX + 10;
    }

    return { left: finalX, top: finalY };
}

function makeDraggable(element, options = {}) {
    const dragButton = typeof options.button === 'number' ? options.button : 0; // default: left click
    const requireDirectTarget = options.requireDirectTarget === true;
    const clampToViewport = options.clampToViewport !== false;
    const margin = typeof options.margin === 'number' ? options.margin : 10;

    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;

    function onMouseDown(e) {
        e = e || window.event;

        // Only allow dragging with configured mouse button.
        if (e.button !== dragButton) return;

        // Optionally only start drag when clicking the element itself (not its children).
        if (requireDirectTarget && e.target !== element) return;

        e.preventDefault();
        e.stopPropagation();

        startClientX = e.clientX;
        startClientY = e.clientY;
        startLeft = Number.isFinite(element.offsetLeft) ? element.offsetLeft : 0;
        startTop = Number.isFinite(element.offsetTop) ? element.offsetTop : 0;

        // Mark as moved so we don't auto-reposition.
        element.dataset.moved = "true";

        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
    }

    function onMouseMove(e) {
        e = e || window.event;
        e.preventDefault();

        const deltaX = e.clientX - startClientX;
        const deltaY = e.clientY - startClientY;

        let nextLeft = startLeft + deltaX;
        let nextTop = startTop + deltaY;

        if (clampToViewport) {
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const width = element.offsetWidth;
            const height = element.offsetHeight;

            const minLeft = scrollX + margin;
            const minTop = scrollY + margin;
            const maxLeft = scrollX + viewportWidth - width - margin;
            const maxTop = scrollY + viewportHeight - height - margin;

            nextLeft = Math.min(Math.max(nextLeft, minLeft), Math.max(minLeft, maxLeft));
            nextTop = Math.min(Math.max(nextTop, minTop), Math.max(minTop, maxTop));
        }

        element.style.left = nextLeft + "px";
        element.style.top = nextTop + "px";
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseup', onMouseUp, true);
    }

    // Avoid stacking multiple handlers if called again for same element.
    if (!element.dataset.draggableAttached) {
        element.addEventListener('mousedown', onMouseDown, true);
        element.dataset.draggableAttached = 'true';
    }
}

function removeTranslateIcon() {
    if (translateIcon?.parentNode) {
        translateIcon.removeEventListener('click', handleTranslateIconClick);
        translateIcon.parentNode.removeChild(translateIcon);
        translateIcon = null;
    }
}
function removeHoverBox() {
    if (hoverBox?.parentNode) {
        hoverBox.parentNode.removeChild(hoverBox);
        hoverBox = null;
    }
}
function removeImageTranslateBox() {
    if (imageTranslateBox?.parentNode) {
        imageTranslateBox.parentNode.removeChild(imageTranslateBox);
        imageTranslateBox = null;
    }
}
function removeSelectionTranslateElements() {
    removeTranslateIcon();
    removeHoverBox();
    currentSelection = null;
}

// === Hàm xử lý sự kiện ===

// Click Icon dịch bôi đen
function handleTranslateIconClick(event) {
    handleSelectionActionClick(event, 'translateSelectedText');
}

// Click Icon tóm tắt bôi đen
function handleSummarizeIconClick(event) {
    handleSelectionActionClick(event, 'summarizeSelectedText');
}

function handleSelectionActionClick(event, action) {
    event.preventDefault();
    event.stopPropagation();

    let initialBoxX = 0, initialBoxY = 0;
    if (translateIcon) {
        const iconRect = translateIcon.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        initialBoxX = iconRect.left + scrollX;
        initialBoxY = iconRect.top + scrollY;
    } else {
        initialBoxX = event.clientX + (window.scrollX || window.pageXOffset);
        initialBoxY = event.clientY + (window.scrollY || window.pageYOffset);
    }

    if (translateIcon) {
        translateIcon.style.display = 'none';
    }

    const selectedText = translateIcon?.dataset?.selectedText;
    if (!selectedText) {
        removeSelectionTranslateElements(); return;
    }

    showHoverBox(initialBoxX, initialBoxY, '', true);

    if (!isExtensionValid()) {
        showHoverBox(initialBoxX, initialBoxY, "Tiện ích đã được tải lại hoặc cập nhật. Vui lòng nhấn F5 để tải lại trang.\n(Extension reloaded. Please refresh the page.)", false);
        return;
    }

    let port;
    try {
        port = chrome.runtime.connect({ name: "content_highlight_stream" });
        port.postMessage({
            action,
            text: selectedText
        });
    } catch (err) {
        showHoverBox(initialBoxX, initialBoxY, "Tiện ích đã được tải lại hoặc cập nhật. Vui lòng nhấn F5 để tải lại trang.\n(Extension reloaded. Please refresh the page.)", false);
        return;
    }

    let fullTranslation = "";

    port.onMessage.addListener((msg) => {
        if (!hoverBox) {
            try { port.disconnect(); } catch (_) {}
            return;
        }

        if (msg.action === "chunk") {
            if (fullTranslation === "") {
                const loader = hoverBox.querySelector('.loading');
                if (loader) loader.remove();
            }
            fullTranslation += msg.text;
            showHoverBox(initialBoxX, initialBoxY, fullTranslation, false);
        } else if (msg.action === "done") {
            try { port.disconnect(); } catch (_) {}
        } else if (msg.action === "error") {
            showHoverBox(initialBoxX, initialBoxY, `Error: ${msg.error}`, false);
            try { port.disconnect(); } catch (_) {}
        }
    });

    port.onDisconnect.addListener(() => {
        try {
            if (chrome?.runtime?.lastError) {
                if (hoverBox) showHoverBox(initialBoxX, initialBoxY, `Connection Error: ${chrome.runtime.lastError.message}`, false);
            }
        } catch (_) {}
    });
}

// Function to handle image translation
function handleImageTranslate(imageUrl) {
    removeHoverBox();
    removeImageTranslateBox();

    const images = document.querySelectorAll('img');
    let targetImage = null;
    let imageX = 0, imageY = 0;

    for (const img of images) {
        if (img.src === imageUrl) {
            targetImage = img;
            break;
        }
    }

    if (targetImage) {
        const rect = targetImage.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        imageX = rect.right + scrollX;
        imageY = rect.bottom + scrollY;
    } else {
        imageX = 100 + (window.scrollX || window.pageXOffset);
        imageY = 100 + (window.scrollY || window.pageYOffset);
    }

    showImageTranslateBox(imageX, imageY, '', true);

    if (!isExtensionValid()) {
        showImageTranslateBox(imageX, imageY, "Tiện ích đã được tải lại hoặc cập nhật. Vui lòng nhấn F5 để tải lại trang.\n(Extension reloaded. Please refresh the page.)", false);
        return;
    }

    let port;
    try {
        port = chrome.runtime.connect({ name: "content_image_stream" });
        port.postMessage({
            action: "translateImage",
            imageUrl: imageUrl
        });
    } catch (err) {
        showImageTranslateBox(imageX, imageY, "Tiện ích đã được tải lại hoặc cập nhật. Vui lòng nhấn F5 để tải lại trang.\n(Extension reloaded. Please refresh the page.)", false);
        return;
    }

    let fullTranslation = "";

    port.onMessage.addListener((msg) => {
        if (!imageTranslateBox) {
            try { port.disconnect(); } catch (_) {}
            return;
        }

        if (msg.action === "chunk") {
            if (fullTranslation === "") {
                const loader = imageTranslateBox.querySelector('.loading');
                if (loader) loader.remove();
            }
            fullTranslation += msg.text;
            showImageTranslateBox(imageX, imageY, fullTranslation, false);
        } else if (msg.action === "done") {
            try { port.disconnect(); } catch (_) {}
        } else if (msg.action === "error") {
            showImageTranslateBox(imageX, imageY, `Error: ${msg.error}`, false);
            try { port.disconnect(); } catch (_) {}
        }
    });

    port.onDisconnect.addListener(() => {
        try {
            if (chrome?.runtime?.lastError) {
                if (imageTranslateBox) showImageTranslateBox(imageX, imageY, `Connection Error: ${chrome.runtime.lastError.message}`, false);
            }
        } catch (_) {}
    });
}


// Nhấn phím Esc (chỉ đóng hover box của highlight)
let escKeyListenerAdded = false;
function handleEscKey(event) {
    if (event.key === 'Escape') {
        const hasHover = hoverBox && document.body.contains(hoverBox);
        const hasImage = imageTranslateBox && document.body.contains(imageTranslateBox);
        if (hasHover || hasImage) {
            event.preventDefault();
            event.stopPropagation();

            if (hasHover) {
                removeSelectionTranslateElements();
            }

            if (hasImage) {
                removeImageTranslateBox();
            }
        }
    }
}
function addEscKeyListener() {
    if (!escKeyListenerAdded) {
        document.addEventListener('keydown', handleEscKey, true);
        escKeyListenerAdded = true;
    }
}

// === Listener chính (Global) ===

// Helper function to check if a node is visible based on Computed Style and Dimensions
function isNodeVisible(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return false;

    // 1. Use modern checkVisibility API if available (Chrome 105+)
    // Checks display:none, visibility:hidden, content-visibility:hidden, opacity:0
    if (element.checkVisibility && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        // console.log('[HyperAssistant] Node hidden (checkVisibility):', element);
        return false;
    }

    // 2. Check Dimensions (Robust against "visually-hidden" 1px hacks)
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) {
        // console.log('[HyperAssistant] Node hidden (dimensions <= 1px):', element, rect.width, rect.height);
        return false;
    }

    // 3. Check aria-hidden on self or ancestors
    if (element.closest('[aria-hidden="true"]')) {
        // console.log('[HyperAssistant] Node hidden (aria-hidden):', element);
        return false;
    }

    // 4. Fallback Computed Style checks (redundant if checkVisibility works, but good for safety)
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        // console.log('[HyperAssistant] Node hidden (computed style):', element);
        return false;
    }

    return true;
}

// Advanced function to extract ONLY visible text from selection, preserving visual layout
function getVisibleSelectionText(selection) {
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Helper to check if node is inside a UI element we want to ignore (buttons, menus, etc.)
    function isUIElement(node) {
        const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!element) return false;
        // Ignore buttons, navigation, menus, etc.
        return element.closest('button, [role="button"], nav, menu, [role="menu"], [role="navigation"]');
    }

    // Optimized case: Selection is within a single text node
    if (container.nodeType === Node.TEXT_NODE) {
        if (!isNodeVisible(container)) return '';
        if (isUIElement(container)) return ''; // Skip if it's a button text
        return container.textContent.substring(range.startOffset, range.endOffset).trim();
    }

    // Complex case: Walk through the DOM tree within the range
    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                // Check if node is visible
                if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;

                // Check if node is part of unwanted UI
                if (isUIElement(node)) return NodeFilter.FILTER_REJECT;

                // Check if node intersects with the range
                if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;

                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    let textParts = [];
    let lastRect = null;
    let currentNode;

    while (currentNode = treeWalker.nextNode()) {
        let nodeText = currentNode.textContent;

        // Trim text based on selection boundaries
        if (currentNode === range.startContainer) {
            nodeText = nodeText.substring(range.startOffset);
        }
        if (currentNode === range.endContainer) {
            nodeText = nodeText.substring(0, range.endOffset);
        }

        // Normalize whitespace within the node itself
        nodeText = nodeText.replace(/\s+/g, ' ').trim();

        if (nodeText.length > 0) {
            // Get position of this text node to determine layout
            const nodeRange = document.createRange();
            nodeRange.selectNodeContents(currentNode);
            const rects = nodeRange.getClientRects();

            if (rects.length > 0) {
                const currentFirstLineRect = rects[0]; // Use the first line of the text node

                if (lastRect) {
                    // Check if the current text is on a new line visually
                    // If the top of the current text is significantly below the bottom of the last text

                    // Check for significant vertical overlap to determine if they are on the "same line"
                    // A tolerance of 0.5 * min(height) is used to account for slight vertical shifts
                    const isSameLine = Math.max(0, Math.min(currentFirstLineRect.bottom, lastRect.bottom) - Math.max(currentFirstLineRect.top, lastRect.top)) > (Math.min(currentFirstLineRect.height, lastRect.height) * 0.5);

                    // If not on the same line AND the current text starts below the previous one, insert a newline
                    if (!isSameLine && currentFirstLineRect.top > lastRect.top) {
                        textParts.push('\n');
                    } else {
                        // Otherwise, insert a space
                        textParts.push(' ');
                    }
                }

                textParts.push(nodeText);

                // Update lastRect to the rect of the LAST line of the current node
                // This is important if the text node itself wraps across multiple lines
                lastRect = rects[rects.length - 1];
            } else {
                // Fallback if no rect (e.g., text node has no visible dimensions, though rare for visible text)
                // In this case, treat it as separated by a space
                if (lastRect) {
                    textParts.push(' ');
                }
            }
        }
    }

    // Join all parts. The trim() at the end removes any leading/trailing spaces/newlines
    // that might have been added unnecessarily at the beginning or end.
    return textParts.join('').trim();
}

// Helper to find the screen coordinates of the last visible text in the selection
function getLastVisibleSelectionRect(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();

    // If simple case works (single rect or tight selection), use it
    // But we know double-click causes issues.
    // Let's try to find the last visible text node in the range.

    const container = range.commonAncestorContainer;
    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;
                if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    let lastVisibleNode = null;
    while (treeWalker.nextNode()) {
        lastVisibleNode = treeWalker.currentNode;
    }

    if (lastVisibleNode) {
        // Create a range for just this last node to get its position
        const tempRange = document.createRange();
        tempRange.selectNodeContents(lastVisibleNode);

        // If the original range ends inside this node, respect the end offset
        if (lastVisibleNode === range.endContainer) {
            tempRange.setEnd(lastVisibleNode, range.endOffset);
        }

        // We only care about the END of this node
        // Let's collapse to end
        tempRange.collapse(false);

        // getClientRects for a collapsed range gives the cursor position
        const tempRects = tempRange.getClientRects();
        if (tempRects.length > 0) {
            return tempRects[0];
        }

        // Fallback: select the last character if collapsed rect is empty/weird
        if (lastVisibleNode.textContent.length > 0) {
            tempRange.selectNodeContents(lastVisibleNode);
            if (lastVisibleNode === range.endContainer) {
                tempRange.setEnd(lastVisibleNode, range.endOffset);
            }
            // Select last char
            const startOffset = Math.max(0, tempRange.endOffset - 1);
            tempRange.setStart(lastVisibleNode, startOffset);
            const charRects = tempRange.getClientRects();
            if (charRects.length > 0) return charRects[charRects.length - 1];
        }
    }

    // Fallback to standard last rect if smart detection fails
    if (rects.length > 0) return rects[rects.length - 1];
    return null;
}

// Click chuột xuống (ẩn UI dịch bôi đen khi click ra ngoài)
document.addEventListener('mousedown', (event) => {
    const clickedOnIcon = translateIcon?.contains(event.target);
    const clickedInHoverBox = hoverBox?.contains(event.target);
    const clickedInImageBox = imageTranslateBox?.contains(event.target);

    if (!clickedOnIcon && !clickedInHoverBox) {
        removeSelectionTranslateElements();
    }

    if (!clickedInImageBox) {
        removeImageTranslateBox();
    }
}, true);

// Nhả chuột (dịch bôi đen)
// Nhả chuột (dịch bôi đen)
let selectionDebounceTimer = null;
document.addEventListener('mouseup', (event) => {
    const clickedOnIcon = translateIcon?.contains(event.target);
    const clickedInHoverBox = hoverBox?.contains(event.target);
    const clickedInImageBox = imageTranslateBox?.contains(event.target);
    if (clickedOnIcon || clickedInHoverBox || clickedInImageBox) {
        return;
    }

    removeSelectionTranslateElements();

    if (!isExtensionValid()) {
        return;
    }

    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

    // Fast check: return early if no text selected to prevent unnecessary tree walking and layout queries
    const activeSel = window.getSelection();
    if (!activeSel || activeSel.isCollapsed || activeSel.toString().trim().length < 2) {
        return;
    }

    // Show ASAP after selection finishes; use rAF for stable rects.
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    selectionDebounceTimer = setTimeout(() => {
        requestAnimationFrame(() => {
            const currentTarget = document.elementFromPoint(mouseX, mouseY);
            const isTargetExtensionUI = currentTarget && (translateIcon?.contains(currentTarget) || hoverBox?.contains(currentTarget) || imageTranslateBox?.contains(currentTarget));
            if (isTargetExtensionUI) {
                return;
            }

            const selection = window.getSelection();
            // Use the new cleaning function based on visibility
            const selectedText = getVisibleSelectionText(selection);

            if (selectedText.length > 1 && selection?.rangeCount > 0) {
                let parentElement = selection.anchorNode?.parentElement;
                if (parentElement && (parentElement.isContentEditable || parentElement.tagName === 'INPUT' || parentElement.tagName === 'TEXTAREA')) {
                    return;
                }

                // Use smart positioning
                const lastRect = getLastVisibleSelectionRect(selection);

                if (!lastRect) return;

                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;

                // Calculate position for the icon (bottom-right of selection)
                // Tighter positioning: +1px offset
                let iconX = lastRect.right + scrollX + 1;
                let iconY = lastRect.bottom + scrollY + 1;

                const iconSize = 32;
                const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight;

                // Adjust position to keep icon within viewport bounds
                let adjustedIconX = Math.min(iconX, scrollX + viewportWidth - iconSize - 2);
                let adjustedIconY = Math.min(iconY, scrollY + viewportHeight - iconSize - 2);
                adjustedIconX = Math.max(adjustedIconX, scrollX + 2);
                adjustedIconY = Math.max(adjustedIconY, scrollY + 2);

                showTranslateIcon(adjustedIconX, adjustedIconY, selectedText);
            }
        });
    }, 0);
}, true);


// === Listen for messages from background script ===
if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "initiateImageTranslate") {
            handleImageTranslate(message.imageUrl);
            sendResponse({ status: "started" });
        } else if (message.action === "initiateFullPageTranslate") {
            if (window === window.top) {
                handleFullPageTranslate();
                sendResponse({ status: "started" });
            } else {
                sendResponse({ status: "ignored_iframe" });
            }
        }
    });
}


// === Logic Dịch Toàn Trang (In-Place Translation Engine) ===

// Block containers: elements that structure content into distinct sections
const BLOCK_CONTAINER_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, figcaption, dt, dd, td, th, table, article, section, header, footer, aside, nav, main, div, form, fieldset, details, summary';

// All candidates that could be leaf text elements
const ALL_CANDIDATE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, dt, dd, td, th, button, a, label, summary, span, div, article, section, header, footer, aside, nav, time, cite, mark';

// Ignored containers: elements that should never be translated or touched
const IGNORED_CONTAINERS_SELECTOR = '#hypertranslator-page-status-bar, #text-translate-hover-box, #image-translate-hover-box, noscript, script, style, code, pre, textarea, input, select, [contenteditable="true"], [translate="no"], .notranslate';

// 1. Wrap naked text nodes that sit directly beside block children so they aren't missed
function wrapOrphanedTextNodes(root = document.body) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                if (!node.nodeValue || node.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
                if (!/[\p{L}]/u.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest(IGNORED_CONTAINERS_SELECTOR)) return NodeFilter.FILTER_REJECT;
                
                // If parent has child block elements, this naked text node needs a wrapper element
                const hasBlockChild = parent.querySelector(BLOCK_CONTAINER_SELECTOR);
                if (hasBlockChild) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const orphanNodes = [];
    let curr;
    while ((curr = walker.nextNode())) {
        orphanNodes.push(curr);
    }

    for (const textNode of orphanNodes) {
        if (!textNode.parentNode) continue;
        const span = document.createElement('span');
        span.className = 'ht-orphan-wrap';
        span.dataset.htOrphan = 'true';
        textNode.parentNode.insertBefore(span, textNode);
        span.appendChild(textNode);
    }
}

// 2. Collect 100% of visible leaf text blocks across the entire page
function collectPageElements() {
    wrapOrphanedTextNodes();

    const candidates = document.querySelectorAll(ALL_CANDIDATE_SELECTOR);
    const elementsToTranslate = [];
    const seenDescendants = new Set();
    const selectedSet = new Set();

    for (const el of candidates) {
        if (seenDescendants.has(el)) continue;
        if (!isNodeVisible(el)) continue;
        if (el.closest(IGNORED_CONTAINERS_SELECTOR)) continue;

        const text = el.innerText?.trim() || '';
        // Must contain at least 2 characters and at least one linguistic letter (skip pure numbers/symbols)
        if (text.length < 2 || !/[\p{L}]/u.test(text)) continue;

        // Leaf Rule 1: Must NOT contain any child structural block container
        // (Inline tags like <a>, <b>, <i>, <code>, <span>, <time> are NOT block containers and are preserved)
        if (el.querySelector(BLOCK_CONTAINER_SELECTOR)) continue;

        // Leaf Rule 2: Generic containers (div, nav, section...) with multiple links are menus/lists;
        // let the individual links be collected instead of merging them
        const isGenericContainer = /^(DIV|NAV|SECTION|HEADER|FOOTER|ASIDE|MAIN)$/i.test(el.tagName);
        if (isGenericContainer && el.querySelectorAll('a').length > 1) continue;

        // Leaf Rule 3: Must not have an ancestor already selected
        let ancestorSelected = false;
        let p = el.parentElement;
        while (p && p !== document.body) {
            if (selectedSet.has(p)) { ancestorSelected = true; break; }
            p = p.parentElement;
        }
        if (ancestorSelected) continue;

        elementsToTranslate.push(el);
        selectedSet.add(el);

        // Mark all descendants so none are collected separately
        const descendants = el.querySelectorAll('*');
        for (const d of descendants) {
            seenDescendants.add(d);
        }
    }

    return elementsToTranslate;
}

async function handleFullPageTranslate(customLang = null) {
    if (pageTranslationActive) return;
    pageTranslationActive = true;

    if (customLang) {
        pageTargetLang = customLang;
    } else {
        try {
            const res = await new Promise(r => chrome.storage.sync.get(['settings'], r));
            pageTargetLang = res?.settings?.defaultTargetLanguage || 'vietnamese';
        } catch (_) {
            pageTargetLang = 'vietnamese';
        }
    }

    createStatusBar();
    scanAndTranslateInPlace();
}

function createStatusBar() {
    if (statusBar) return;
    statusBar = document.createElement('div');
    statusBar.id = 'hypertranslator-page-status-bar';
    statusBar.innerHTML = `
        <div class="status-left">
            <div class="ht-spinner"></div>
            <span id="ht-status-message">Đang dịch trang... (0%)</span>
        </div>
        <div class="status-center">
            <label for="ht-page-target-lang">Ngôn ngữ:</label>
            <select id="ht-page-target-lang" title="Đổi ngôn ngữ dịch">
                <option value="vietnamese">Tiếng Việt</option>
                <option value="english">English</option>
                <option value="chinese (simplified)">中文 (简体)</option>
                <option value="chinese (traditional)">中文 (繁體)</option>
                <option value="japanese">日本語</option>
                <option value="korean">한국어</option>
                <option value="french">Français</option>
                <option value="german">Deutsch</option>
                <option value="spanish">Español</option>
                <option value="russian">Русский</option>
            </select>
        </div>
        <div class="status-right">
            <button type="button" id="hypertranslator-restore-btn">Khôi phục trang gốc</button>
            <button type="button" id="hypertranslator-close-bar-btn" title="Đóng thanh trạng thái">✕</button>
        </div>
    `;
    document.body.appendChild(statusBar);

    const langSelect = statusBar.querySelector('#ht-page-target-lang');
    if (langSelect) {
        langSelect.value = pageTargetLang;
        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            restorePage();
            setTimeout(() => {
                handleFullPageTranslate(newLang);
            }, 100);
        });
    }

    document.getElementById('hypertranslator-restore-btn').addEventListener('click', restorePage);
    document.getElementById('hypertranslator-close-bar-btn').addEventListener('click', () => {
        if (statusBar) {
            statusBar.remove();
            statusBar = null;
        }
    });
}

function updateStatusBar(progress, total) {
    const msg = document.getElementById('ht-status-message');
    if (msg) {
        const percent = total > 0 ? Math.round((progress / total) * 100) : 0;
        msg.textContent = `Đang dịch trang... ${progress}/${total} (${percent}%)`;
        if (progress >= total && total > 0) {
            msg.textContent = `Dịch hoàn tất (${total} mục)`;
            const spinner = statusBar?.querySelector('.ht-spinner');
            if (spinner) spinner.style.display = 'none';
        }
    }
}

// Global DOM batch queue to eliminate layout thrashing & achieve 60 FPS
let pendingDomUpdates = [];
let rafId = null;

function queueDomUpdate(id, text) {
    pendingDomUpdates.push({ id, text });
    if (!rafId) {
        rafId = requestAnimationFrame(flushDomUpdates);
    }
}

function flushDomUpdates() {
    rafId = null;
    if (!pageTranslationActive) {
        pendingDomUpdates = [];
        return;
    }

    const updatesToApply = pendingDomUpdates.splice(0, pendingDomUpdates.length);
    for (const { id, text } of updatesToApply) {
        const record = pageBlockMap.get(id);
        if (!record || !text) continue;
        const el = record.element;
        if (!el || !document.body.contains(el)) continue;

        if (record.hasChildTags) {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
        pageTranslatedCount++;
    }

    updateStatusBar(pageTranslatedCount, pageTotalBlocks);
}

async function scanAndTranslateInPlace() {
    const elements = collectPageElements();
    pageTotalBlocks = elements.length;
    pageTranslatedCount = 0;
    updateStatusBar(0, pageTotalBlocks);

    if (pageTotalBlocks === 0) {
        updateStatusBar(0, 0);
        return;
    }

    // High-Capacity Batching: 250 items per batch
    // Entire webpage (100-250 blocks) runs in EXACTLY 1 REQUEST!
    // Takes full advantage of Gemini 3.5 Flash Lite 1M token context & 65k output limit
    const BATCH_SIZE = 250;
    const allBatches = [];

    for (let i = 0; i < elements.length; i += BATCH_SIZE) {
        const slice = elements.slice(i, i + BATCH_SIZE);
        const payloadDict = {};
        slice.forEach(el => {
            const id = String(++blockIdCounter);
            el.dataset.htId = id;

            // Preserve inline tags (<a>, <b>, <i>, <code>, <span>)
            const hasChildTags = el.children.length > 0;
            const contentToSend = hasChildTags ? el.innerHTML.trim() : el.textContent.trim();

            pageBlockMap.set(id, {
                element: el,
                originalHTML: el.innerHTML,
                hasChildTags: hasChildTags
            });

            payloadDict[id] = contentToSend;
        });
        allBatches.push(payloadDict);
    }

    for (const batch of allBatches) {
        if (!pageTranslationActive) break;
        await translateBatchInPlace(batch);
    }
}

function translateBatchInPlace(batchPayload) {
    return new Promise((resolve) => {
        if (!pageTranslationActive) { resolve(); return; }

        if (!isExtensionValid()) {
            console.warn("[HyperAssistant] Extension context disconnected.");
            resolve();
            return;
        }

        let port;
        try {
            port = chrome.runtime.connect({ name: "content_page_batch" });
            port.postMessage({
                action: "translatePageBatch",
                targetLanguage: pageTargetLang,
                batchData: batchPayload
            });
        } catch (e) {
            console.warn("[HyperAssistant] Failed to connect batch port:", e);
            resolve();
            return;
        }

        let buffer = "";
        const appliedKeys = new Set();
        let timeoutTimer = null;

        function cleanup() {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            try { port.disconnect(); } catch (_) {}
        }

        // Safety timeout of 60 seconds per batch for large pages
        timeoutTimer = setTimeout(() => {
            cleanup();
            flushDomUpdates();
            resolve();
        }, 60000);

        function processStreamBuffer() {
            let cleaned = buffer.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
            else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);

            const regex = /"(\d+)":\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = regex.exec(cleaned)) !== null) {
                const id = match[1];
                if (!appliedKeys.has(id)) {
                    appliedKeys.add(id);
                    let text = match[2];
                    try {
                        text = JSON.parse(`"${text}"`);
                    } catch (_) {
                        text = text.replace(/\\"/g, '"').replace(/\\n/g, '\n');
                    }
                    queueDomUpdate(id, text);
                }
            }
        }

        function finalizeParse() {
            processStreamBuffer();
            // Fallback: parse complete JSON if any trailing key was missed by regex
            try {
                let finalClean = buffer.trim();
                if (finalClean.startsWith('```json')) finalClean = finalClean.slice(7);
                else if (finalClean.startsWith('```')) finalClean = finalClean.slice(3);
                if (finalClean.endsWith('```')) finalClean = finalClean.slice(0, -3);

                const jsonEnd = finalClean.lastIndexOf('}');
                if (jsonEnd !== -1) finalClean = finalClean.substring(0, jsonEnd + 1);

                const fullObj = JSON.parse(finalClean);
                for (const [id, text] of Object.entries(fullObj)) {
                    if (!appliedKeys.has(id)) {
                        appliedKeys.add(id);
                        queueDomUpdate(id, text);
                    }
                }
            } catch (_) {}

            flushDomUpdates();
        }

        port.onMessage.addListener((msg) => {
            if (msg.action === "chunk") {
                buffer += msg.text;
                processStreamBuffer();
            } else if (msg.action === "done") {
                finalizeParse();
                cleanup();
                resolve();
            } else if (msg.action === "error") {
                console.error("[HyperAssistant] Batch translation error:", msg.error);
                cleanup();
                flushDomUpdates();
                resolve();
            }
        });

        port.onDisconnect.addListener(() => {
            cleanup();
            flushDomUpdates();
            resolve();
        });
    });
}

function restorePage() {
    pageTranslationActive = false;

    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    pendingDomUpdates = [];

    pageBlockMap.forEach((record) => {
        const el = record.element;
        if (!el || !document.body.contains(el)) return;
        el.innerHTML = record.originalHTML;
        delete el.dataset.htId;
    });

    pageBlockMap.clear();

    // Clean up wrapped orphan text nodes
    document.querySelectorAll('.ht-orphan-wrap').forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        span.remove();
    });

    if (statusBar) {
        statusBar.remove();
        statusBar = null;
    }
}

// === Khởi tạo ===
initialize();
