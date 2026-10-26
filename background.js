// Background Service Worker - Proscom Prix 2026
// Cadeauette TN

function updateExtensionIcon() {
    try {
        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            
            // Fond bleu nuit arrondi
            ctx.fillStyle = '#0d1b3e';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(0, 0, 32, 32, 7);
                ctx.fill();
            } else {
                ctx.fillRect(0, 0, 32, 32);
            }

            // Lettre P turquoise
            ctx.fillStyle = '#00b4a0';
            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('P', 15, 17);

            // Point accent doré
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.arc(24, 24, 3.5, 0, Math.PI * 2);
            ctx.fill();

            const imageData = ctx.getImageData(0, 0, 32, 32);
            chrome.action.setIcon({ imageData: imageData }, () => {
                if (chrome.runtime.lastError) {
                    // Ignore fallback
                }
            });
        }
    } catch (e) {
        // Fallback transparent
    }
}

// Initialisation au démarrage et à l'installation
chrome.runtime.onInstalled.addListener(() => {
    updateExtensionIcon();

    // 1. Menu contextuel sur sélection de texte ou référence
    chrome.contextMenus.create({
        id: "proscom-search-selection",
        title: "Chercher le prix Proscom pour « %s »",
        contexts: ["selection"]
    }, () => {
        if (chrome.runtime.lastError) {}
    });

    // 2. Menu contextuel direct sur la page ou frame PDF
    chrome.contextMenus.create({
        id: "proscom-detect-page",
        title: "📄 Ouvrir les prix Proscom de cette page",
        contexts: ["page", "frame"]
    }, () => {
        if (chrome.runtime.lastError) {}
    });
});

chrome.runtime.onStartup.addListener(() => {
    updateExtensionIcon();
});

// Clic sur les menus contextuels
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "proscom-search-selection" && info.selectionText) {
        const query = info.selectionText.trim();
        const pageMatch = query.match(/^(?:page|p\.?)?\s*(\d{1,3})$/i);
        const refMatch = query.match(/\b(\d{1,3}(?:[A-Za-z])?[-–]26(?:-[A-Za-z0-9]+)?)\b/);

        const dataToSave = { pendingSearch: query };
        if (pageMatch) {
            const pNum = parseInt(pageMatch[1], 10);
            if (pNum >= 1 && pNum <= 174) dataToSave.pendingPage = pNum;
        }
        if (refMatch) {
            dataToSave.pendingRef = refMatch[1].replace('–', '-');
        }

        chrome.storage.local.set(dataToSave, () => {
            if (chrome.action && chrome.action.openPopup) {
                chrome.action.openPopup().catch(() => {});
            }
        });
    } else if (info.menuItemId === "proscom-detect-page") {
        if (chrome.action && chrome.action.openPopup) {
            chrome.action.openPopup().catch(() => {});
        }
    }
});
