// content.js - v15 (Streaming Support)

// === Biến toàn cục ===
let translateIcon = null;         // Icon dịch bôi đen (thay cho nút G)
let hoverBox = null;                // Box kết quả G
let currentSelection = null;        // Selection hiện tại
let imageTranslateBox = null;       // Box kết quả dịch ảnh

// === Biến toàn cục cho Dịch Toàn Trang ===
let pageTranslationActive = false;
let originalTextMap = new Map(); // id -> { node, originalText }
let statusBar = null;
let translatedNodesCount = 0;
let totalNodesToTranslate = 0;
let uniqueIdCounter = 0;

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
        return true;
    } else if (message.action === "initiateFullPageTranslate") {
        if (window !== window.top) return false;
        handleFullPageTranslate();
        return true;
    }
    return false;
    });
}


// === Logic Dịch Toàn Trang ===

function handleFullPageTranslate() {
    if (pageTranslationActive) return; // Prevent double run
    pageTranslationActive = true;

    createStatusBar();
    scanAndTranslatePage();
}

function createStatusBar() {
    if (statusBar) return;
    statusBar = document.createElement('div');
    statusBar.id = 'hypertranslator-page-status-bar';
    statusBar.innerHTML = `
        <div class="status-text">
            <div class="ht-spinner"></div>
            <span id="ht-status-message">Translating page... (0%)</span>
        </div>
        <div class="status-actions">
            <button id="hypertranslator-restore-btn">Restore Original</button>
            <button id="hypertranslator-close-bar-btn">✕</button>
        </div>
    `;
    document.body.appendChild(statusBar);

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
        const percent = Math.round((progress / total) * 100);
        msg.textContent = `Translating page... (${percent}%)`;
        if (progress >= total) {
            msg.textContent = "Translation Complete";
            const spinner = statusBar.querySelector('.ht-spinner');
            if (spinner) spinner.style.display = 'none';
        }
    }
}

function restorePage() {
    originalTextMap.forEach((value, id) => {
        if (value.node) {
            value.node.textContent = value.originalText;
        }
    });
    originalTextMap.clear();
    pageTranslationActive = false;
    if (statusBar) {
        const spinner = statusBar.querySelector('.ht-spinner');
        if (spinner) spinner.style.display = 'none';
        const msg = document.getElementById('ht-status-message');
        if (msg) msg.textContent = "Restored Original";
        setTimeout(() => {
            if (statusBar) statusBar.remove();
            statusBar = null;
        }, 1000);
    }
}

async function scanAndTranslatePage() {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Ignore specific tags
                const tag = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'code', 'pre', 'textarea', 'input', 'select', 'option'].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                }

                // Ignore empty or symbol-only text (supports all languages: Latin, Vietnamese, CJK, Cyrillic, Arabic, etc.)
                const text = node.textContent.trim();
                if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const validNodes = [];
    let currentNode;
    while (currentNode = walker.nextNode()) {
        validNodes.push(currentNode);
    }

    totalNodesToTranslate = validNodes.length;
    translatedNodesCount = 0;
    updateStatusBar(0, totalNodesToTranslate);

    // Batching & Parallel Processing
    const BATCH_SIZE = 40; // Reduced slightly to avoid huge prompt overloads per request
    const MAX_CONCURRENT_REQUESTS = 3; // Number of parallel requests

    const allBatches = [];
    for (let i = 0; i < validNodes.length; i += BATCH_SIZE) {
        const batchNodes = validNodes.slice(i, i + BATCH_SIZE);
        const batchPayload = [];
        batchNodes.forEach(node => {
            const id = `ht_node_${++uniqueIdCounter}`;
            // Store original if not exists
            if (!originalTextMap.has(id)) {
                originalTextMap.set(id, { node: node, originalText: node.textContent });
            }
            batchPayload.push({ id: id, text: node.textContent.trim() });
        });
        allBatches.push(batchPayload);
    }

    // Process batches with concurrency limit
    let activeRequests = 0;
    let batchIndex = 0;

    return new Promise((resolve) => {
        function next() {
            if (!pageTranslationActive) {
                if (activeRequests === 0) resolve();
                return;
            }

            // If we have processed all batches and no active requests are left
            if (batchIndex >= allBatches.length && activeRequests === 0) {
                resolve();
                return;
            }

            // Start new requests if we are below limit and have items left
            while (activeRequests < MAX_CONCURRENT_REQUESTS && batchIndex < allBatches.length) {
                const currentBatch = allBatches[batchIndex++];
                activeRequests++;

                translateBatch(currentBatch).finally(() => {
                    activeRequests--;
                    next(); // Recursively call next to pick up work or finish
                });
            }
        }

        next(); // Kick off
    });
}


function translateBatch(batchPayload) {
    return new Promise((resolve) => {
        if (!pageTranslationActive) { resolve(); return; }

        if (!isExtensionValid()) {
            console.warn("[HyperAssistant] Extension disconnected, cannot translate batch.");
            resolve();
            return;
        }

        let port;
        try {
            port = chrome.runtime.connect({ name: "content_page_batch" });
            port.postMessage({
                action: "translatePageBatch",
                batchData: batchPayload
            });
        } catch (err) {
            console.warn("[HyperAssistant] Connection failed:", err);
            resolve();
            return;
        }

        let fullResponse = "";
        let buffer = ""; // Current chunk buffer

        // Helper to extract and apply objects from stream
        function processStreamBuffer() {
            // We look for objects matching pattern {"id":..., "text":...}
            // Simple approach: Iterate through buffer and try to find balanced braces that form valid JSON
            let startIndex = buffer.indexOf('{');
            while (startIndex !== -1) {
                let braceCount = 0;
                let endIndex = -1;
                let inString = false;
                let escape = false;

                // Scan forward from startIndex to find matching closing brace
                for (let i = startIndex; i < buffer.length; i++) {
                    const char = buffer[i];

                    if (escape) { escape = false; continue; }
                    if (char === '\\') { escape = true; continue; }
                    if (char === '"') { inString = !inString; continue; }

                    if (!inString) {
                        if (char === '{') braceCount++;
                        if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                endIndex = i;
                                break;
                            }
                        }
                    }
                }

                if (endIndex !== -1) {
                    // Potential object found
                    const jsonStr = buffer.substring(startIndex, endIndex + 1);
                    try {
                        const obj = JSON.parse(jsonStr);
                        if (obj.id && obj.text) {
                            applyTranslations([obj]); // Apply immediately
                        }

                        // Move past this object
                        buffer = buffer.substring(endIndex + 1);
                        startIndex = buffer.indexOf('{');
                    } catch (e) {
                        // Invalid JSON, maybe just partially similar structure or text. 
                        // If parsing failed but we found balanced braces, it implies structure error or just garbage.
                        // We skip this '{' and search next
                        startIndex = buffer.indexOf('{', startIndex + 1);
                    }
                } else {
                    // No closing brace found yet, wait for more chunks
                    break;
                }
            }
        }

        port.onMessage.addListener((msg) => {
            if (msg.action === "chunk") {
                fullResponse += msg.text;
                buffer += msg.text;
                processStreamBuffer();
            } else if (msg.action === "done") {
                // Final flush/check (in case any remained, or fallback for whole array)
                // If stream parsing worked, buffer should be mostly empty or just `]`.

                // Safety net: if nothing was translated via stream (maybe format was weird), try full parse
                // But generally processStreamBuffer should handle it.
                if (buffer.trim().length > 5) {
                    // Try parsing what's left
                    processStreamBuffer();
                }

                port.disconnect();
                resolve();
            } else if (msg.action === "error") {
                console.error("Batch translate error", msg.error);
                port.disconnect();
                resolve(); // Continue anyway
            }
        });

        port.onDisconnect.addListener(() => {
            resolve();
        });
    });
}

function applyTranslations(translations) {
    if (!pageTranslationActive) return;

    translations.forEach(item => {
        const id = item.id;
        const newText = item.text;

        if (originalTextMap.has(id)) {
            const { node } = originalTextMap.get(id);
            if (node && newText) {
                node.textContent = newText; // Replace text
            }
        }
        translatedNodesCount++;
    });

    updateStatusBar(translatedNodesCount, totalNodesToTranslate);
}

// === Khởi tạo ===
initialize();