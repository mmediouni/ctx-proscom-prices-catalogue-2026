// ==========================================================================
// Proscom Prix 2026 - Logique Applicative (Cadeauette TN)
// ==========================================================================

// État global de l'application
const AppState = {
    produits: window.PRODUITS || [],
    categories: window.CATEGORIES || [],
    favorites: new Set(),
    cart: {}, // { ref: { ref, nom, prix, page, cat, qty } }
    clientName: '',
    settings: {
        margin: 0,
        tva: 0.19,
        showResale: true,
        darkMode: false
    },
    activeCategory: 'ALL',
    searchQuery: '',
    sortOption: 'relevance',
    activePdfPage: null,       // Page PDF détectée ou sélectionnée (ex: 24)
    detectedPdfRefs: [],       // Références exactes trouvées sur la page
    isPdfDetected: false
};

// Chargement synchrone immédiat (Cache résilient 0ms : panier, client & marge revendeur)
try {
    const cachedSettings = localStorage.getItem('proscomSettings');
    if (cachedSettings) {
        const parsedSettings = JSON.parse(cachedSettings);
        if (parsedSettings && typeof parsedSettings === 'object') {
            AppState.settings = Object.assign(AppState.settings, parsedSettings);
        }
    }
    const cachedCart = localStorage.getItem('proscomCart');
    if (cachedCart) {
        const parsed = JSON.parse(cachedCart);
        if (parsed && typeof parsed === 'object') AppState.cart = parsed;
    }
    const cachedClient = localStorage.getItem('proscomClientName');
    if (cachedClient) AppState.clientName = cachedClient;
} catch (e) {
    console.warn('Cache local synchrone indisponible:', e);
}

// Éléments DOM
const DOM = {
    // Onglets & Navigation
    tabBtns: document.querySelectorAll('.tab-btn'),
    panels: document.querySelectorAll('.panel'),
    cartCountBadge: document.getElementById('cartCountBadge'),
    favCountBadge: document.getElementById('favCountBadge'),
    currentMarginBadge: document.getElementById('currentMarginBadge'),
    totalItemsBadge: document.getElementById('totalItemsBadge'),

    // Recherche & Détection PDF
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryContainer: document.getElementById('categoryContainer'),
    autoSearchBanner: document.getElementById('autoSearchBanner'),
    autoSearchText: document.getElementById('autoSearchText'),
    closeBannerBtn: document.getElementById('closeBannerBtn'),
    pdfDetectorBar: document.getElementById('pdfDetectorBar'),
    pdfDetectorTitle: document.getElementById('pdfDetectorTitle'),
    pdfDetectorSub: document.getElementById('pdfDetectorSub'),
    pdfPrevPageBtn: document.getElementById('pdfPrevPageBtn'),
    pdfNextPageBtn: document.getElementById('pdfNextPageBtn'),
    pdfPageInput: document.getElementById('pdfPageInput'),
    pdfResetFilterBtn: document.getElementById('pdfResetFilterBtn'),
    togglePdfBarBtn: document.getElementById('togglePdfBarBtn'),
    pdfQuickPages: document.getElementById('pdfQuickPages'),
    quickChips: document.querySelectorAll('.quick-chip'),
    fileAccessWarning: document.getElementById('fileAccessWarning'),
    openExtensionSettingsBtn: document.getElementById('openExtensionSettingsBtn'),
    resultsCount: document.getElementById('resultsCount'),
    sortSelect: document.getElementById('sortSelect'),
    resultsContainer: document.getElementById('results'),

    // Devis / Panier
    cartClientInput: document.getElementById('cartClientInput'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartCountTitle: document.getElementById('cartCountTitle'),
    clearCartBtn: document.getElementById('clearCartBtn'),
    clearConfirmBox: document.getElementById('clearConfirmBox'),
    confirmClearCartBtn: document.getElementById('confirmClearCartBtn'),
    cancelClearCartBtn: document.getElementById('cancelClearCartBtn'),
    cartTotalBox: document.getElementById('cartTotalBox'),
    cartTotalBrutHT: document.getElementById('cartTotalBrutHT'),
    cartMarginRow: document.getElementById('cartMarginRow'),
    cartMarginLabel: document.getElementById('cartMarginLabel'),
    cartTotalResaleHT: document.getElementById('cartTotalResaleHT'),
    cartTvaLabel: document.getElementById('cartTvaLabel'),
    cartTotalTVA: document.getElementById('cartTotalTVA'),
    cartTotalTTC: document.getElementById('cartTotalTTC'),
    copyQuoteBtn: document.getElementById('copyQuoteBtn'),

    // Favoris
    favResults: document.getElementById('favResults'),
    favCountTitle: document.getElementById('favCountTitle'),

    // Réglages
    marginInput: document.getElementById('marginInput'),
    showResalePriceToggle: document.getElementById('showResalePriceToggle'),
    tvaInput: document.getElementById('tvaInput'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastIcon: document.getElementById('toastIcon'),
    toastMessage: document.getElementById('toastMessage')
};

// ==========================================================================
// Utilitaires de Formatage et Recherche
// ==========================================================================

// Supprime les accents et met en minuscules pour comparaison tolérante
function normalizeText(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// Formate un montant en dinars tunisiens (ex: 79,800 DT)
function formatPrice(amount) {
    if (amount === null || isNaN(amount)) return 'Sur Devis';
    return amount.toFixed(3).replace('.', ',') + ' DT';
}

// Extrait la valeur numérique d'un prix en chaîne
function parsePrice(prixStr) {
    if (!prixStr || prixStr.includes('Devis')) return null;
    const clean = prixStr.replace(/\s/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
}

// Affiche un toast d'information temporaire
let toastTimeout = null;
function showToast(message, isSuccess = true) {
    if (toastTimeout) clearTimeout(toastTimeout);
    DOM.toastIcon.textContent = isSuccess ? '✓' : 'ℹ';
    DOM.toastMessage.textContent = message;
    DOM.toast.className = 'toast show ' + (isSuccess ? 'toast-success' : '');
    toastTimeout = setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 2400);
}

// ==========================================================================
// Moteur de Recherche & Filtrage Avancé avec Priorité Page PDF
// ==========================================================================

// Détermine si un produit figure sur un numéro de page donné (comparaison exacte ou tolérante)
function isProductOnPage(item, pageNum) {
    if (!item.page || !pageNum) return false;
    const pStr = String(pageNum).trim().toLowerCase();
    const itemPStr = String(item.page).trim().toLowerCase();
    if (itemPStr === pStr) return true;

    const p = parseInt(pageNum, 10);
    const itemP = parseInt(item.page, 10);
    if (!isNaN(p) && !isNaN(itemP) && p === itemP) return true;

    if (item.page.includes('-')) {
        const parts = item.page.split('-');
        const min = parseInt(parts[0], 10);
        const max = parseInt(parts[1], 10);
        if (!isNaN(min) && !isNaN(max)) {
            return p >= min && p <= max;
        }
    }
    return false;
}

// Calcule le score de priorité PDF (les articles de la page en cours affichés en premier lieu)
function getPdfPriorityScore(item) {
    let score = 0;
    const normRef = normalizeText(item.ref);

    // 1. Références exactes détectées sur la page / sélection (Top priorité)
    if (AppState.detectedPdfRefs && AppState.detectedPdfRefs.length > 0) {
        const isExact = AppState.detectedPdfRefs.some(dRef => {
            const normD = normalizeText(dRef);
            return normRef === normD || normRef.split('-')[0] === normD.split('-')[0];
        });
        if (isExact) score += 3000;
    }

    // 2. Appartenance à la page active du catalogue PDF (ex: page 24 dans la plage 14-31)
    if (AppState.activePdfPage && isProductOnPage(item, AppState.activePdfPage)) {
        score += 1500;
    }

    return score;
}

function executeSearch() {
    const rawQuery = DOM.searchInput.value.trim();
    AppState.searchQuery = rawQuery;

    // Afficher/masquer le bouton d'effacement
    DOM.clearSearchBtn.style.display = rawQuery ? 'flex' : 'none';

    const normalizedQuery = normalizeText(rawQuery);
    const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

    const explicitPageMatch = rawQuery.match(/^(?:page|p\.?)\s*(\d{1,3})$/i);
    let targetPageQuery = null;
    if (explicitPageMatch) {
        targetPageQuery = explicitPageMatch[1];
    }

    let filtered = AppState.produits.filter(item => {
        // Filtre Catégorie
        if (AppState.activeCategory !== 'ALL') {
            if (AppState.activeCategory === 'PROMO') {
                const isPromo = item.cat === 'Promotions' || item.nom.toUpperCase().includes('PROMO');
                if (!isPromo) return false;
            } else if (item.cat !== AppState.activeCategory) {
                return false;
            }
        }

        // Si requête explicite de page (ex: "page 24" ou "p24")
        if (targetPageQuery) {
            return isProductOnPage(item, targetPageQuery);
        }

        // Si aucune recherche textuelle, conserver l'élément
        if (tokens.length === 0) return true;

        const normalizedRef = normalizeText(item.ref);
        const normalizedNom = normalizeText(item.nom);

        // Référence sans suffixe d'année (ex: "24" pour "24-26")
        const baseRef = normalizedRef.split('-')[0];

        // Tous les mots-clés doivent correspondre soit à la réf, au nom ou au numéro de page
        return tokens.every(token => {
            return normalizedRef.includes(token) || 
                   baseRef === token || 
                   normalizedNom.includes(token) ||
                   item.page === token ||
                   isProductOnPage(item, token);
        });
    });

    // Score de pertinence et tri (Articles de la page PDF en premier lieu !)
    filtered.sort((a, b) => {
        // 1. Priorité aux articles de la page PDF active ou références détectées
        const prioA = getPdfPriorityScore(a);
        const prioB = getPdfPriorityScore(b);
        if (prioA !== prioB) {
            return prioB - prioA; // Articles de la page PDF en tête !
        }

        // 2. Options de tri demandées par l'utilisateur
        if (AppState.sortOption === 'price-asc') {
            const pA = parsePrice(a.prix) ?? 999999;
            const pB = parsePrice(b.prix) ?? 999999;
            return pA - pB;
        }
        if (AppState.sortOption === 'price-desc') {
            const pA = parsePrice(a.prix) ?? -1;
            const pB = parsePrice(b.prix) ?? -1;
            return pB - pA;
        }
        if (AppState.sortOption === 'ref') {
            const numA = parseInt(a.ref) || 0;
            const numB = parseInt(b.ref) || 0;
            return numA - numB;
        }

        // 3. Par défaut : Pertinence textuelle
        if (tokens.length > 0) {
            const normRefA = normalizeText(a.ref);
            const normRefB = normalizeText(b.ref);
            const queryExact = tokens[0];

            // Match exact de référence
            const exactA = (normRefA === queryExact || normRefA.split('-')[0] === queryExact);
            const exactB = (normRefB === queryExact || normRefB.split('-')[0] === queryExact);
            if (exactA && !exactB) return -1;
            if (!exactA && exactB) return 1;

            // Débute par la référence
            const startsA = normRefA.startsWith(queryExact);
            const startsB = normRefB.startsWith(queryExact);
            if (startsA && !startsB) return -1;
            if (!startsA && startsB) return 1;
        }

        return 0;
    });

    // Mise à jour de l'étiquette des résultats
    if (AppState.activePdfPage) {
        const pageMatches = filtered.filter(i => isProductOnPage(i, AppState.activePdfPage)).length;
        DOM.resultsCount.textContent = `${filtered.length} article(s) • Page ${AppState.activePdfPage} prioritaire (${pageMatches})`;
    } else {
        DOM.resultsCount.textContent = `${filtered.length} article(s) trouvé(s)`;
    }

    renderResults(filtered, DOM.resultsContainer, tokens);
}

// Surligne les mots-clés dans le texte
function highlightText(text, tokens) {
    if (!tokens || tokens.length === 0) return escapeHTML(text);
    let safe = escapeHTML(text);
    tokens.forEach(tok => {
        if (tok.length < 2) return;
        const regex = new RegExp(`(${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        safe = safe.replace(regex, '<mark>$1</mark>');
    });
    return safe;
}

function escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// ==========================================================================
// Rendu des Cartes Produits
// ==========================================================================

function renderResults(items, container, tokens = []) {
    container.innerHTML = '';

    if (items.length === 0) {
        DOM.resultsCount.textContent = 'Aucun article trouvé';
        container.innerHTML = `
            <div class="results-empty">
                <div class="empty-icon">🔍</div>
                <div>Aucun produit ne correspond à votre recherche.</div>
                <div style="font-size:11px; margin-top:4px; color:var(--text-muted);">
                    Essayez un numéro de réf (ex: 24, 187) ou un nom simple (stylo, mug, gourde).
                </div>
            </div>
        `;
        return;
    }

    DOM.resultsCount.textContent = `${items.length} article(s) trouvé(s)`;

    // Limiter l'affichage à 100 items max pour garder une fluidité parfaite
    const displayList = items.slice(0, 100);

    displayList.forEach(item => {
        const card = createProductCard(item, tokens);
        container.appendChild(card);
    });

    if (items.length > 100) {
        const moreDiv = document.createElement('div');
        moreDiv.style.textAlign = 'center';
        moreDiv.style.padding = '10px';
        moreDiv.style.fontSize = '11px';
        moreDiv.style.color = 'var(--text-muted)';
        moreDiv.textContent = `+ ${items.length - 100} autres résultats. Affinez votre recherche.`;
        container.appendChild(moreDiv);
    }
}

function createProductCard(item, tokens = []) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.ref = item.ref;

    const isFav = AppState.favorites.has(item.ref);
    const isPromo = item.cat === 'Promotions' || (item.nom && item.nom.toUpperCase().includes('PROMO'));
    const isSurDevis = !item.prix || item.prix.includes('Devis');
    const inCartItem = AppState.cart[item.ref];

    const numHT = parsePrice(item.prix);
    let priceHTText = item.prix;
    let priceTTCText = 'Sur Devis';
    let resaleText = '';

    if (numHT !== null) {
        priceHTText = formatPrice(numHT);
        const ttcVal = numHT * (1 + AppState.settings.tva);
        priceTTCText = formatPrice(ttcVal);

        if (AppState.settings.margin > 0 && AppState.settings.showResale) {
            const resaleHT = numHT * (1 + AppState.settings.margin / 100);
            resaleText = `Vente cons. : ${formatPrice(resaleHT)} HT`;
        }
    }

    const inCartBadge = inCartItem ? `<span class="in-cart-badge" title="Cet article est actuellement dans votre devis en mémoire">✓ Au devis (${inCartItem.qty} pcs)</span>` : '';

    const isPageMatch = AppState.activePdfPage && isProductOnPage(item, AppState.activePdfPage);
    const isRefMatch = AppState.detectedPdfRefs && AppState.detectedPdfRefs.some(dRef => {
        const normD = normalizeText(dRef);
        const normR = normalizeText(item.ref);
        return normR === normD || normR.split('-')[0] === normD.split('-')[0];
    });

    let pdfBadge = '';
    if (isRefMatch) {
        pdfBadge = `<span class="ref-detected-badge" title="Cette référence figure sur votre écran de lecture">🎯 Sur la page</span>`;
        card.classList.add('card-ref-match');
    } else if (isPageMatch) {
        pdfBadge = `<span class="page-detected-badge" title="Cet article figure sur la page ${AppState.activePdfPage} du catalogue PDF">📄 Page ${escapeHTML(item.page)}</span>`;
        card.classList.add('card-page-match');
    }

    card.innerHTML = `
        <div class="card-top-row">
            <div class="card-tags">
                <span class="ref-badge">Réf ${escapeHTML(item.ref)}</span>
                <span class="page-badge" title="Page dans le catalogue papier ou PDF">📄 p. ${escapeHTML(item.page || 'N/A')}</span>
                ${isPromo ? '<span class="promo-badge">PROMO</span>' : ''}
                ${pdfBadge}
                ${inCartBadge}
                <span class="category-tag">${escapeHTML(item.cat || '')}</span>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                ${isFav ? '★' : '☆'}
            </button>
        </div>

        <div class="product-title">${highlightText(item.nom, tokens)}</div>

        <div class="price-section">
            <span class="price-ht">HT : ${priceHTText}</span>
            <span class="price-ttc">TTC : ${priceTTCText}</span>
            ${resaleText ? `<span class="price-resale" title="Prix conseillé avec marge revendeur">${resaleText}</span>` : ''}
        </div>

        <div class="card-actions">
            <div class="qty-input-group" title="Calculateur rapide pour une quantité client">
                <label>Qté :</label>
                <input type="number" class="qty-input" min="1" step="1" placeholder="Ex: 50" value="${inCartItem ? inCartItem.qty : ''}">
                <span class="qty-total-calc"></span>
            </div>
            <button class="btn-sm btn-secondary btn-add-cart" title="${inCartItem ? 'Modifier la quantité dans le devis' : 'Ajouter au devis'}">
                ${inCartItem ? `✓ Au devis (${inCartItem.qty})` : '+ Devis'}
            </button>
            <button class="btn-sm btn-accent btn-copy" title="Copier les détails du produit">
                📋 Copier
            </button>
        </div>
    `;

    // Événement Favori
    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item.ref);
    });

    // Événement Calculateur de quantité
    const qtyInput = card.querySelector('.qty-input');
    const qtyTotalCalc = card.querySelector('.qty-total-calc');
    qtyInput.addEventListener('input', () => {
        const q = parseInt(qtyInput.value);
        if (q > 0 && numHT !== null) {
            const totalHT = q * numHT;
            qtyTotalCalc.textContent = `= ${formatPrice(totalHT)} HT`;
            qtyTotalCalc.style.display = 'inline-block';
        } else {
            qtyTotalCalc.style.display = 'none';
        }
    });

    // Événement Ajouter au panier de devis
    const addCartBtn = card.querySelector('.btn-add-cart');
    addCartBtn.addEventListener('click', () => {
        const q = parseInt(qtyInput.value) || 1;
        // Si déjà dans le panier, met à jour la quantité définie par l'utilisateur
        addToCart(item, q, !!AppState.cart[item.ref]);
    });

    // Événement Copier les détails (1 clic)
    const copyBtn = card.querySelector('.btn-copy');
    copyBtn.addEventListener('click', () => {
        copyProductInfo(item, numHT);
    });

    return card;
}

// Met à jour dynamiquement l'état visuel d'une carte produit déjà affichée
function updateCardsInCartStatus(targetRef) {
    const cards = document.querySelectorAll(`.product-card[data-ref="${targetRef}"]`);
    cards.forEach(card => {
        const inCartItem = AppState.cart[targetRef];
        const tagsContainer = card.querySelector('.card-tags');
        let badge = tagsContainer.querySelector('.in-cart-badge');
        const addBtn = card.querySelector('.btn-add-cart');
        const qtyInput = card.querySelector('.qty-input');

        if (inCartItem) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'in-cart-badge';
                const catTag = tagsContainer.querySelector('.category-tag');
                if (catTag) {
                    tagsContainer.insertBefore(badge, catTag);
                } else {
                    tagsContainer.appendChild(badge);
                }
            }
            badge.textContent = `✓ Au devis (${inCartItem.qty} pcs)`;
            badge.title = 'Cet article est actuellement dans votre devis en mémoire';
            if (addBtn) {
                addBtn.textContent = `✓ Au devis (${inCartItem.qty})`;
                addBtn.title = 'Modifier la quantité dans le devis';
            }
            if (qtyInput && !qtyInput.value) {
                qtyInput.value = inCartItem.qty;
            }
        } else {
            if (badge) badge.remove();
            if (addBtn) {
                addBtn.textContent = '+ Devis';
                addBtn.title = 'Ajouter au devis';
            }
        }
    });
}

// ==========================================================================
// Copie Rapide au Presse-Papier
// ==========================================================================

function copyProductInfo(item, numHT) {
    let copyText = `Réf: ${item.ref} | ${item.nom}`;
    if (numHT !== null) {
        const ttc = numHT * (1 + AppState.settings.tva);
        copyText += ` | HT: ${formatPrice(numHT)} | TTC: ${formatPrice(ttc)}`;
        if (AppState.settings.margin > 0) {
            const resaleHT = numHT * (1 + AppState.settings.margin / 100);
            copyText += ` | Prix vente cons.: ${formatPrice(resaleHT)} HT`;
        }
    } else {
        copyText += ` | Prix: Sur Devis`;
    }
    if (item.page) copyText += ` (Catalogue 2026 p. ${item.page})`;

    navigator.clipboard.writeText(copyText).then(() => {
        showToast(`Copié : Réf ${item.ref}`);
    }).catch(() => {
        showToast('Erreur lors de la copie', false);
    });
}

// ==========================================================================
// Gestion des Favoris
// ==========================================================================

function toggleFavorite(ref) {
    if (AppState.favorites.has(ref)) {
        AppState.favorites.delete(ref);
        showToast(`Réf ${ref} retirée des favoris`);
    } else {
        AppState.favorites.add(ref);
        showToast(`Réf ${ref} ajoutée aux favoris`);
    }
    saveFavorites();
    updateFavBadge();
    executeSearch(); // Rafraîchit les icônes étoiles
    renderFavorites();
}

function updateFavBadge() {
    const count = AppState.favorites.size;
    DOM.favCountBadge.textContent = count;
    DOM.favCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
    DOM.favCountTitle.textContent = `${count} article(s) favori(s)`;
}

function renderFavorites() {
    DOM.favResults.innerHTML = '';
    const favItems = AppState.produits.filter(p => AppState.favorites.has(p.ref));

    if (favItems.length === 0) {
        DOM.favResults.innerHTML = `
            <div class="fav-empty">
                <div class="empty-icon">⭐</div>
                <div>Aucun article favori pour le moment.</div>
                <div style="font-size:11px; margin-top:4px; color:var(--text-muted);">
                    Cliquez sur l'étoile d'un produit dans le catalogue pour l'épingler ici.
                </div>
            </div>
        `;
        return;
    }

    favItems.forEach(item => {
        const card = createProductCard(item);
        DOM.favResults.appendChild(card);
    });
}

function saveFavorites() {
    const list = Array.from(AppState.favorites);
    chrome.storage.local.set({ proscomFavorites: list });
}

// ==========================================================================
// Gestion du Panier & Simulateur de Devis
// ==========================================================================

function addToCart(item, qty = 1, replace = false) {
    if (!AppState.cart[item.ref]) {
        AppState.cart[item.ref] = {
            ref: item.ref,
            nom: item.nom,
            prix: item.prix,
            page: item.page,
            cat: item.cat,
            qty: qty
        };
        showToast(`Ajouté au devis : ${qty}x Réf ${item.ref}`);
    } else {
        if (replace) {
            AppState.cart[item.ref].qty = qty;
            showToast(`Devis mis à jour : ${qty}x Réf ${item.ref}`);
        } else {
            AppState.cart[item.ref].qty += qty;
            showToast(`Quantité augmentée : ${AppState.cart[item.ref].qty}x Réf ${item.ref}`);
        }
    }
    saveCart();
    renderCart();
    updateCardsInCartStatus(item.ref);
}

function updateCartQty(ref, delta) {
    if (!AppState.cart[ref]) return;
    AppState.cart[ref].qty += delta;
    if (AppState.cart[ref].qty <= 0) {
        delete AppState.cart[ref];
        showToast(`Réf ${ref} retirée du devis`);
    }
    saveCart();
    renderCart();
    updateCardsInCartStatus(ref);
}

function removeCartItem(ref) {
    delete AppState.cart[ref];
    saveCart();
    renderCart();
    updateCardsInCartStatus(ref);
    showToast(`Réf ${ref} retirée du devis`);
}

function clearCart() {
    AppState.cart = {};
    saveCart();
    renderCart();
    if (DOM.clearConfirmBox) DOM.clearConfirmBox.style.display = 'none';

    // Nettoie l'ensemble des indicateurs de devis sur le catalogue visible
    document.querySelectorAll('.in-cart-badge').forEach(b => b.remove());
    document.querySelectorAll('.btn-add-cart').forEach(btn => {
        btn.textContent = '+ Devis';
        btn.title = 'Ajouter au devis';
    });
    showToast('Devis entièrement vidé');
}

function renderCart() {
    const items = Object.values(AppState.cart);
    DOM.cartCountBadge.textContent = items.length;
    DOM.cartCountBadge.style.display = items.length > 0 ? 'inline-block' : 'none';
    DOM.cartCountTitle.textContent = `Articles sélectionnés (${items.length})`;

    if (DOM.cartClientInput && DOM.cartClientInput.value !== (AppState.clientName || '')) {
        DOM.cartClientInput.value = AppState.clientName || '';
    }

    if (items.length === 0) {
        if (DOM.clearConfirmBox) DOM.clearConfirmBox.style.display = 'none';
        DOM.cartItemsList.innerHTML = `
            <div class="cart-empty">
                <div class="empty-icon">📋</div>
                <div>Votre devis est vide.</div>
                <div style="font-size:11px; margin-top:4px; color:var(--text-muted);">
                    Ajoutez des articles depuis le catalogue pour composer votre offre.
                </div>
            </div>
        `;
        DOM.cartTotalBox.style.display = 'none';
        DOM.copyQuoteBtn.style.display = 'none';
        return;
    }

    DOM.cartItemsList.innerHTML = '';
    let totalBrutHT = 0;
    let hasSurDevis = false;

    items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item';

        const numHT = parsePrice(item.prix);
        let subtotalText = 'Sur Devis';

        if (numHT !== null) {
            const subtotal = numHT * item.qty;
            totalBrutHT += subtotal;
            subtotalText = formatPrice(subtotal);
        } else {
            hasSurDevis = true;
        }

        itemRow.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-title">Réf ${escapeHTML(item.ref)} - ${escapeHTML(item.nom)}</div>
                <div class="cart-item-meta">PU : ${item.prix} HT | Total : <strong>${subtotalText}</strong></div>
            </div>
            <div class="cart-item-qty">
                <button class="cart-stepper-btn btn-minus">−</button>
                <span style="font-weight:700; width:22px; text-align:center;">${item.qty}</span>
                <button class="cart-stepper-btn btn-plus">+</button>
                <button class="btn-sm btn-secondary btn-del" style="margin-left:4px; padding:3px 6px;">✕</button>
            </div>
        `;

        itemRow.querySelector('.btn-minus').addEventListener('click', () => updateCartQty(item.ref, -1));
        itemRow.querySelector('.btn-plus').addEventListener('click', () => updateCartQty(item.ref, 1));
        itemRow.querySelector('.btn-del').addEventListener('click', () => removeCartItem(item.ref));

        DOM.cartItemsList.appendChild(itemRow);
    });

    // Calculs totaux
    DOM.cartTotalBox.style.display = 'block';
    DOM.copyQuoteBtn.style.display = 'flex';

    DOM.cartTotalBrutHT.textContent = formatPrice(totalBrutHT) + (hasSurDevis ? ' (+ devis)' : '');

    let effectiveBaseHT = totalBrutHT;
    if (AppState.settings.margin > 0) {
        effectiveBaseHT = totalBrutHT * (1 + AppState.settings.margin / 100);
        DOM.cartMarginRow.style.display = 'flex';
        DOM.cartMarginLabel.textContent = `Total Vente HT (+${AppState.settings.margin}%) :`;
        DOM.cartTotalResaleHT.textContent = formatPrice(effectiveBaseHT);
    } else {
        DOM.cartMarginRow.style.display = 'none';
    }

    const tvaVal = effectiveBaseHT * AppState.settings.tva;
    const ttcVal = effectiveBaseHT + tvaVal;

    DOM.cartTvaLabel.textContent = `TVA (${Math.round(AppState.settings.tva * 100)}%) :`;
    DOM.cartTotalTVA.textContent = formatPrice(tvaVal);
    DOM.cartTotalTTC.textContent = formatPrice(ttcVal) + (hasSurDevis ? ' (+ devis)' : '');
}

// Persistance double couche (Synchrone localStorage + Asynchrone chrome.storage)
function saveCart() {
    try {
        localStorage.setItem('proscomCart', JSON.stringify(AppState.cart));
    } catch (e) {
        console.warn('Erreur écriture localStorage:', e);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ proscomCart: AppState.cart });
    }
}

function saveClientName() {
    try {
        localStorage.setItem('proscomClientName', AppState.clientName);
    } catch (e) {}
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ proscomClientName: AppState.clientName });
    }
}

function copyFullQuote() {
    const items = Object.values(AppState.cart);
    if (items.length === 0) return;

    let lines = [];
    lines.push('=========================================');
    lines.push('DEVIS ESTIMATIF - CATALOGUE PROSCOM 2026');
    lines.push('Cadeauette TN • Objets & Cadeaux d\'affaires');
    if (AppState.clientName && AppState.clientName.trim()) {
        lines.push(`Client / Dossier : ${AppState.clientName.trim()}`);
    }
    const today = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    lines.push(`Date : ${today}`);
    lines.push('=========================================');

    let totalBrutHT = 0;
    items.forEach((it, idx) => {
        const numHT = parsePrice(it.prix);
        let subtotalStr = 'Sur Devis';
        if (numHT !== null) {
            const sub = numHT * it.qty;
            totalBrutHT += sub;
            subtotalStr = formatPrice(sub);
        }
        lines.push(`${idx + 1}. [Réf ${it.ref}] ${it.nom}`);
        lines.push(`   Quantité : ${it.qty} | P.U HT : ${it.prix} | Sous-total : ${subtotalStr}`);
    });

    lines.push('-----------------------------------------');
    let effectiveBase = totalBrutHT;
    if (AppState.settings.margin > 0) {
        effectiveBase = totalBrutHT * (1 + AppState.settings.margin / 100);
        lines.push(`Total Brut HT : ${formatPrice(totalBrutHT)}`);
        lines.push(`Marge revendeur (+${AppState.settings.margin}%)`);
        lines.push(`Total Vente HT : ${formatPrice(effectiveBase)}`);
    } else {
        lines.push(`Total HT : ${formatPrice(totalBrutHT)}`);
    }

    const tva = effectiveBase * AppState.settings.tva;
    const ttc = effectiveBase + tva;
    lines.push(`TVA (${Math.round(AppState.settings.tva * 100)}%) : ${formatPrice(tva)}`);
    lines.push(`TOTAL ESTIMÉ TTC : ${formatPrice(ttc)}`);
    lines.push('=========================================');
    lines.push('* Devis indicatif sous réserve de disponibilité des stocks.');

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
        showToast('Devis complet copié pour e-mail / WhatsApp !');
    }).catch(() => {
        showToast('Erreur de copie', false);
    });
}

// ==========================================================================
// Gestion des Réglages & Thème
// ==========================================================================

function saveSettingsData(showFeedback = false) {
    try {
        localStorage.setItem('proscomSettings', JSON.stringify(AppState.settings));
    } catch (e) {
        console.warn('Erreur écriture localStorage settings:', e);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ proscomSettings: AppState.settings });
    }
    if (showFeedback) {
        showToast(`Marge enregistrée (+${AppState.settings.margin}%) jusqu'à modification manuelle`);
    }
}

function loadSettings(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['proscomSettings', 'proscomFavorites', 'proscomCart', 'proscomClientName', 'pendingSearch'], (result) => {
            if (result.proscomSettings) {
                AppState.settings = Object.assign(AppState.settings, result.proscomSettings);
                try { localStorage.setItem('proscomSettings', JSON.stringify(AppState.settings)); } catch(e) {}
            } else if (AppState.settings.margin > 0) {
                // Si chrome.storage n'avait rien mais que le cache local contenait la marge, réinscrire
                chrome.storage.local.set({ proscomSettings: AppState.settings });
            }

            if (result.proscomFavorites && Array.isArray(result.proscomFavorites)) {
                AppState.favorites = new Set(result.proscomFavorites);
            }
            
            // Réconciliation Devis persistant
            if (result.proscomCart && Object.keys(result.proscomCart).length > 0) {
                AppState.cart = result.proscomCart;
                try { localStorage.setItem('proscomCart', JSON.stringify(AppState.cart)); } catch(e) {}
            } else if (Object.keys(AppState.cart).length > 0) {
                chrome.storage.local.set({ proscomCart: AppState.cart });
            }

            // Réconciliation Nom Client / Projet
            if (result.proscomClientName !== undefined && result.proscomClientName !== null) {
                AppState.clientName = result.proscomClientName;
                try { localStorage.setItem('proscomClientName', AppState.clientName); } catch(e) {}
            } else if (AppState.clientName) {
                chrome.storage.local.set({ proscomClientName: AppState.clientName });
            }

            applySettingsUI();
            updateFavBadge();
            renderCart();

            if (callback) callback(result.pendingSearch);
        });
    } else {
        applySettingsUI();
        updateFavBadge();
        renderCart();
        if (callback) callback(null);
    }
}

function applySettingsUI() {
    DOM.marginInput.value = AppState.settings.margin || 0;
    DOM.showResalePriceToggle.checked = AppState.settings.showResale !== false;
    DOM.tvaInput.value = Math.round((AppState.settings.tva || 0.19) * 100);
    DOM.darkModeToggle.checked = !!AppState.settings.darkMode;

    // Badge marge en-tête toujours visible et interactif
    DOM.currentMarginBadge.textContent = `+${AppState.settings.margin || 0}%`;
    DOM.currentMarginBadge.style.display = 'inline-block';

    // Appliquer le thème
    if (AppState.settings.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function saveSettings() {
    const margin = Math.max(0, parseFloat(DOM.marginInput.value) || 0);
    const tvaPercent = Math.max(0, parseFloat(DOM.tvaInput.value) || 19);
    const showResale = DOM.showResalePriceToggle.checked;
    const darkMode = DOM.darkModeToggle.checked;

    AppState.settings = {
        margin: margin,
        tva: tvaPercent / 100,
        showResale: showResale,
        darkMode: darkMode
    };

    saveSettingsData(true);
    applySettingsUI();
    renderCart();
    executeSearch();
}

// ==========================================================================
// Initialisation de la Page & Événements
// ==========================================================================

function initCategories() {
    DOM.categoryContainer.innerHTML = '';

    // Bouton Tous
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-pill active';
    allBtn.dataset.cat = 'ALL';
    allBtn.textContent = 'Tous';
    DOM.categoryContainer.appendChild(allBtn);

    // Bouton Promotions spécial
    const promoBtn = document.createElement('button');
    promoBtn.className = 'cat-pill';
    promoBtn.dataset.cat = 'PROMO';
    promoBtn.textContent = '🔥 Promotions';
    DOM.categoryContainer.appendChild(promoBtn);

    // Toutes les catégories
    AppState.categories.forEach(cat => {
        if (cat === 'Promotions') return; // Déjà présent
        const btn = document.createElement('button');
        btn.className = 'cat-pill';
        btn.dataset.cat = cat;
        btn.textContent = cat;
        DOM.categoryContainer.appendChild(btn);
    });

    // Événements sur les pilules
    DOM.categoryContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.cat-pill');
        if (!btn) return;
        DOM.categoryContainer.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.activeCategory = btn.dataset.cat;
        executeSearch();
    });
}

function switchTab(tabId) {
    DOM.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    DOM.panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });

    if (tabId === 'cartTab') renderCart();
    if (tabId === 'favTab') renderFavorites();
}

// Debounce pour recherche rapide
let debounceTimer = null;
function handleSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        executeSearch();
    }, 120);
}

// ==========================================================================
// Démarrage Principal (DOMContentLoaded)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initCategories();

    // Onglets
    DOM.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Recherche
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(debounceTimer);
            executeSearch();
        }
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.searchInput.focus();
        executeSearch();
    });

    DOM.sortSelect.addEventListener('change', () => {
        AppState.sortOption = DOM.sortSelect.value;
        executeSearch();
    });

    DOM.closeBannerBtn.addEventListener('click', () => {
        DOM.autoSearchBanner.style.display = 'none';
    });

    // Panier / Devis & Confirmation sécurisée sans dialogue natif
    DOM.clearCartBtn.addEventListener('click', () => {
        if (Object.keys(AppState.cart).length === 0) {
            showToast('Le devis est déjà vide', false);
            return;
        }
        DOM.clearConfirmBox.style.display = 'block';
    });

    DOM.cancelClearCartBtn.addEventListener('click', () => {
        DOM.clearConfirmBox.style.display = 'none';
    });

    DOM.confirmClearCartBtn.addEventListener('click', () => {
        DOM.clearConfirmBox.style.display = 'none';
        clearCart();
    });

    // Événement Saisie Nom Client / Dossier (Persistance automatique)
    let clientDebounce = null;
    DOM.cartClientInput.addEventListener('input', () => {
        clearTimeout(clientDebounce);
        clientDebounce = setTimeout(() => {
            AppState.clientName = DOM.cartClientInput.value.trim();
            saveClientName();
        }, 200);
    });

    DOM.copyQuoteBtn.addEventListener('click', copyFullQuote);

    // Contrôles interactifs du détecteur de page PDF
    DOM.pdfPrevPageBtn.addEventListener('click', () => {
        if (AppState.activePdfPage > 1) {
            applyDetectedPdfPage(AppState.activePdfPage - 1);
        }
    });

    DOM.pdfNextPageBtn.addEventListener('click', () => {
        const current = AppState.activePdfPage || 0;
        if (current < 174) {
            applyDetectedPdfPage(current + 1);
        }
    });

    DOM.pdfPageInput.addEventListener('change', () => {
        const p = parseInt(DOM.pdfPageInput.value, 10);
        if (!isNaN(p)) applyDetectedPdfPage(p);
    });

    DOM.pdfPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const p = parseInt(DOM.pdfPageInput.value, 10);
            if (!isNaN(p)) applyDetectedPdfPage(p);
        }
    });

    DOM.pdfResetFilterBtn.addEventListener('click', () => {
        AppState.activePdfPage = null;
        AppState.detectedPdfRefs = [];
        DOM.pdfDetectorBar.style.display = 'none';
        DOM.pdfPageInput.value = '';
        executeSearch();
        showToast('Filtre de page réinitialisé');
    });

    if (DOM.togglePdfBarBtn) {
        DOM.togglePdfBarBtn.addEventListener('click', () => {
            const isVisible = DOM.pdfDetectorBar.style.display !== 'none';
            DOM.pdfDetectorBar.style.display = isVisible ? 'none' : 'flex';
            if (DOM.pdfQuickPages) {
                DOM.pdfQuickPages.style.display = isVisible ? 'none' : 'flex';
            }
            if (!isVisible) {
                DOM.pdfPageInput.focus();
                DOM.pdfPageInput.select();
            }
        });
    }

    // Bouton d'ouverture directe des réglages de l'extension
    if (DOM.openExtensionSettingsBtn) {
        DOM.openExtensionSettingsBtn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
            }
        });
    }

    // Raccourcis rapides de chapitres catalogue
    if (DOM.quickChips) {
        DOM.quickChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const pageNum = parseInt(chip.getAttribute('data-page'), 10);
                if (!isNaN(pageNum)) {
                    applyDetectedPdfPage(pageNum);
                }
            });
        });
    }

    // Clic rapide sur le badge de marge dans l'en-tête pour modification instantanée
    DOM.currentMarginBadge.addEventListener('click', () => {
        switchTab('settingsTab');
        DOM.marginInput.focus();
        DOM.marginInput.select();
    });

    // Paramètres & Sauvegarde automatique en temps réel de la marge
    DOM.marginInput.addEventListener('input', () => {
        const val = parseFloat(DOM.marginInput.value);
        AppState.settings.margin = isNaN(val) ? 0 : Math.max(0, val);
        saveSettingsData(false);
        DOM.currentMarginBadge.textContent = `+${AppState.settings.margin}%`;
        renderCart();
        executeSearch();
    });

    DOM.tvaInput.addEventListener('input', () => {
        const val = parseFloat(DOM.tvaInput.value);
        AppState.settings.tva = isNaN(val) ? 0.19 : Math.max(0, val) / 100;
        saveSettingsData(false);
        renderCart();
    });

    DOM.showResalePriceToggle.addEventListener('change', () => {
        AppState.settings.showResale = DOM.showResalePriceToggle.checked;
        saveSettingsData(false);
        executeSearch();
    });

    DOM.saveSettingsBtn.addEventListener('click', saveSettings);
    DOM.darkModeToggle.addEventListener('change', () => {
        AppState.settings.darkMode = DOM.darkModeToggle.checked;
        saveSettingsData(false);
        if (DOM.darkModeToggle.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    });

    // Chargement de l'état persistant & Détection automatique de la page PDF en cours
    loadSettings(() => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['pendingSearch', 'pendingPage', 'pendingRef'], (res) => {
                let hasAction = false;
                if (res.pendingPage) {
                    applyDetectedPdfPage(res.pendingPage);
                    chrome.storage.local.remove('pendingPage');
                    hasAction = true;
                }
                if (res.pendingRef) {
                    DOM.searchInput.value = res.pendingRef;
                    AppState.detectedPdfRefs = [res.pendingRef];
                    chrome.storage.local.remove('pendingRef');
                    hasAction = true;
                }
                if (res.pendingSearch && !hasAction) {
                    DOM.searchInput.value = res.pendingSearch;
                    DOM.autoSearchText.textContent = `Recherche contextuelle : « ${res.pendingSearch} »`;
                    DOM.autoSearchBanner.style.display = 'flex';
                    chrome.storage.local.remove('pendingSearch');
                    hasAction = true;
                }

                executeSearch();

                // 2. Détection intelligente du contexte PDF dans Chrome
                if (!res.pendingPage) {
                    detectActivePdfPage();
                }
            });
        } else {
            executeSearch();
            detectActivePdfPage();
        }
    });
});

// ==========================================================================
// Moteur de Détection Intelligente PDF & Références de Page
// ==========================================================================

function getSectionForPage(pageNum) {
    const p = parseInt(pageNum, 10);
    if (isNaN(p)) return null;
    for (let i = 0; i < AppState.produits.length; i++) {
        const item = AppState.produits[i];
        if (isProductOnPage(item, p)) {
            return item.page; // ex: "14-31"
        }
    }
    return null;
}

function applyDetectedPdfPage(pageNum, isAuto = false) {
    const p = parseInt(pageNum, 10);
    if (isNaN(p) || p < 1 || p > 174) return;

    AppState.activePdfPage = p;
    AppState.isPdfDetected = true;

    DOM.pdfDetectorBar.style.display = 'flex';
    DOM.pdfDetectorTitle.textContent = `Page PDF active : Page ${p}`;
    DOM.pdfPageInput.value = p;

    const count = AppState.produits.filter(item => isProductOnPage(item, p)).length;
    const sectionName = getSectionForPage(p) || `${p}`;

    if (AppState.detectedPdfRefs && AppState.detectedPdfRefs.length > 0) {
        DOM.pdfDetectorSub.textContent = `🎯 ${AppState.detectedPdfRefs.length} réf. détectée(s) • ${count} article(s) de la page ${p} affichés en premier`;
    } else {
        DOM.pdfDetectorSub.textContent = `${count} article(s) de la page ${p} affichés en premier avec leurs tarifs`;
    }

    if (isAuto) {
        showToast(`Page PDF ${p} détectée : articles prioritaires affichés`);
    }

    executeSearch();
}

function detectActivePdfPage() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;

    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError || !tabs || tabs.length === 0) return;
            const activeTab = tabs[0];
            if (!activeTab || !activeTab.id || !activeTab.url) return;

            // Ignorer les pages internes de configuration Chrome standard
            if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
                return;
            }

            const url = activeTab.url;
            const title = activeTab.title || '';
            const isPdf = url.toLowerCase().includes('.pdf') || 
                          title.toLowerCase().includes('.pdf') ||
                          url.includes('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai') ||
                          url.startsWith('file://');

            // Afficher la barre de contrôle et raccourcis si un PDF est actif
            if (isPdf) {
                DOM.pdfDetectorBar.style.display = 'flex';
                if (DOM.pdfQuickPages) DOM.pdfQuickPages.style.display = 'flex';
            }

            // Vérification de la permission pour les fichiers locaux file:///
            if (url.startsWith('file://') && typeof chrome.extension !== 'undefined' && chrome.extension.isAllowedFileSchemeAccess) {
                chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
                    if (!isAllowed && DOM.fileAccessWarning) {
                        DOM.fileAccessWarning.style.display = 'flex';
                    }
                });
            }

            let detectedPage = null;

            // 1. Détection via fragment URL (#page=24, ?page=24, #p24, /page/24)
            const urlPageMatch = url.match(/[#&?](?:page|p)=?(\d+)/i) || 
                                 url.match(/#(\d+)$/) ||
                                 url.match(/\/page\/(\d+)/i);
            if (urlPageMatch) {
                const p = parseInt(urlPageMatch[1], 10);
                if (!isNaN(p) && p >= 1 && p <= 174) detectedPage = p;
            }

            // 2. Détection via titre de l'onglet (ex: "Proscom 2026 - Page 24", "[24] Proscom", "24 / 168")
            if (!detectedPage) {
                const titlePageMatch = title.match(/(?:page|p\.?)\s*(\d+)/i) || 
                                       title.match(/\[(\d+)\]/) ||
                                       title.match(/(\d+)\s*\/\s*\d+/);
                if (titlePageMatch) {
                    const p = parseInt(titlePageMatch[1], 10);
                    if (!isNaN(p) && p >= 1 && p <= 174) detectedPage = p;
                }
            }

            // 3. Inspection approfondie de l'onglet (Chrome Native PDFium, Shadow DOM, PDF.js, texte et références)
            if (chrome.scripting && chrome.scripting.executeScript) {
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id, allFrames: true },
                    function: () => {
                        const res = {
                            page: null,
                            refs: [],
                            selectedText: ''
                        };

                        try {
                            // A. Texte sélectionné par l'utilisateur
                            const sel = window.getSelection() ? window.getSelection().toString().trim() : '';
                            res.selectedText = sel;

                            // B. Parcours récursif des Shadow DOM (Chrome PDF Viewer / PDFium)
                            function searchShadowTree(node, depth = 0) {
                                if (!node || depth > 8) return null;

                                // 1. Attributs directs sur l'élément
                                if (node.pageNo) {
                                    const p = parseInt(node.pageNo, 10);
                                    if (!isNaN(p) && p >= 1 && p <= 200) return p;
                                }
                                if (typeof node.getAttribute === 'function') {
                                    const aP = node.getAttribute('page-no') || node.getAttribute('page');
                                    if (aP) {
                                        const p = parseInt(aP, 10);
                                        if (!isNaN(p) && p >= 1 && p <= 200) return p;
                                    }
                                }

                                // 2. Éléments input
                                if (node.querySelectorAll) {
                                    const inputs = node.querySelectorAll('#page-input, #input, input#page, #pageNumber, .pageNumber, input[type="text"], input[type="number"]');
                                    for (const inp of inputs) {
                                        if (inp && inp.value) {
                                            const p = parseInt(inp.value, 10);
                                            if (!isNaN(p) && p >= 1 && p <= 200) return p;
                                        }
                                    }
                                }

                                // 3. Exploration des Shadow Roots enfants
                                if (node.shadowRoot) {
                                    const p = searchShadowTree(node.shadowRoot, depth + 1);
                                    if (p) return p;
                                }

                                const children = node.children || [];
                                for (let i = 0; i < children.length; i++) {
                                    const p = searchShadowTree(children[i], depth + 1);
                                    if (p) return p;
                                }

                                return null;
                            }

                            // Recherche Shadow DOM sur le document et sur <pdf-viewer>
                            res.page = searchShadowTree(document);

                            // C. Viewport Chrome PDFium
                            if (!res.page) {
                                const pv = document.querySelector('pdf-viewer');
                                if (pv && pv.viewport) {
                                    if (typeof pv.viewport.getMostVisiblePageNumber === 'function') {
                                        res.page = pv.viewport.getMostVisiblePageNumber();
                                    } else if (typeof pv.viewport.getCurrentPage === 'function') {
                                        res.page = pv.viewport.getCurrentPage();
                                    } else if (pv.viewport.page_) {
                                        res.page = pv.viewport.page_;
                                    }
                                }
                            }

                            // D. PDF.js (Mozilla / Web)
                            if (!res.page && window.PDFViewerApplication) {
                                if (window.PDFViewerApplication.page) {
                                    res.page = window.PDFViewerApplication.page;
                                } else if (window.PDFViewerApplication.pdfViewer && window.PDFViewerApplication.pdfViewer.currentPageNumber) {
                                    res.page = window.PDFViewerApplication.pdfViewer.currentPageNumber;
                                }
                            }

                            // E. Scan des références d'articles Proscom sur l'écran
                            const refRegex = /\b(\d{1,3}(?:[A-Za-z])?[-–]26(?:-[A-Za-z0-9]+)?)\b/g;
                            const foundRefs = new Set();

                            function scanText(txt) {
                                if (!txt) return;
                                let m;
                                while ((m = refRegex.exec(txt)) !== null) {
                                    foundRefs.add(m[1].replace('–', '-'));
                                }
                            }

                            if (sel) scanText(sel);

                            const textLayers = document.querySelectorAll('.textLayer, [data-page-number], .page');
                            if (textLayers.length > 0) {
                                textLayers.forEach(el => scanText(el.innerText || el.textContent || ''));
                            } else if (document.body) {
                                scanText(document.body.innerText ? document.body.innerText.substring(0, 10000) : '');
                            }

                            res.refs = Array.from(foundRefs);

                            // F. Si sélection de texte indique explicitement une page (ex: "Page 24", "p. 24")
                            if (!res.page && sel) {
                                const selPageMatch = sel.match(/(?:page|p\.?)\s*(\d{1,3})/i);
                                if (selPageMatch) {
                                    const p = parseInt(selPageMatch[1], 10);
                                    if (!isNaN(p) && p >= 1 && p <= 174) res.page = p;
                                }
                            }
                        } catch (err) {}

                        return res;
                    }
                }, (results) => {
                    let allRefs = [];
                    let selectedText = '';

                    if (!chrome.runtime.lastError && results && Array.isArray(results)) {
                        for (const r of results) {
                            if (r && r.result) {
                                if (!detectedPage && r.result.page) {
                                    const pNum = parseInt(r.result.page, 10);
                                    if (!isNaN(pNum) && pNum >= 1 && pNum <= 174) detectedPage = pNum;
                                }
                                if (r.result.refs && r.result.refs.length > 0) {
                                    allRefs.push(...r.result.refs);
                                }
                                if (!selectedText && r.result.selectedText) {
                                    selectedText = r.result.selectedText;
                                }
                            }
                        }
                    }

                    if (allRefs.length > 0) {
                        AppState.detectedPdfRefs = [...new Set(allRefs)];
                    }

                    // 4. Moteur de Déduction : si la page n'est pas détectée via le viewer, la déduire des références présentes !
                    if (!detectedPage && AppState.detectedPdfRefs.length > 0) {
                        for (const ref of AppState.detectedPdfRefs) {
                            const cleanRef = ref.split('-').slice(0, 2).join('-');
                            const matched = AppState.produits.find(p => p.ref === ref || p.ref.startsWith(cleanRef));
                            if (matched && matched.page) {
                                const p = parseInt(matched.page, 10);
                                if (!isNaN(p)) {
                                    detectedPage = p;
                                    break;
                                }
                            }
                        }
                    }

                    // 5. Si texte sélectionné simple
                    if (selectedText && selectedText.length >= 2 && selectedText.length <= 40 && AppState.detectedPdfRefs.length === 0) {
                        const numOnly = parseInt(selectedText.trim(), 10);
                        if (!detectedPage && !isNaN(numOnly) && numOnly >= 1 && numOnly <= 174) {
                            detectedPage = numOnly;
                        } else {
                            DOM.searchInput.value = selectedText;
                            DOM.autoSearchText.textContent = `Sélection : « ${selectedText} »`;
                            DOM.autoSearchBanner.style.display = 'flex';
                        }
                    }

                    if (detectedPage) {
                        applyDetectedPdfPage(detectedPage, true);
                    } else if (isPdf) {
                        DOM.pdfDetectorBar.style.display = 'flex';
                        DOM.pdfDetectorTitle.textContent = 'Catalogue PDF Proscom 2026';
                        DOM.pdfDetectorSub.textContent = 'Indiquez ou sélectionnez une page pour afficher ses tarifs';
                        if (DOM.pdfQuickPages) DOM.pdfQuickPages.style.display = 'flex';
                    }
                });
                return;
            }

            // Fallback si executeScript n'est pas autorisé
            if (detectedPage) {
                applyDetectedPdfPage(detectedPage, true);
            } else if (isPdf) {
                DOM.pdfDetectorBar.style.display = 'flex';
                DOM.pdfDetectorTitle.textContent = 'Catalogue PDF Proscom 2026';
                DOM.pdfDetectorSub.textContent = 'Indiquez ou sélectionnez une page pour afficher ses tarifs';
                if (DOM.pdfQuickPages) DOM.pdfQuickPages.style.display = 'flex';
            }
        });
    } catch (err) {
        console.warn('Erreur détection PDF:', err);
    }
}