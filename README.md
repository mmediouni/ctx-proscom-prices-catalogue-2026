# Proscom Prix - Catalogue 2026 📑💼

Extension Google Chrome professionnelle développée pour **Cadeauette TN**, conçue pour simplifier la consultation des tarifs, la détection intelligente des articles depuis le catalogue PDF et l'édition instantanée de devis avec marge commerciale revendeur.

---

## ✨ Fonctionnalités Principales

### 1. 🔍 Base de Données Complète 2026 (Page par Page)
* **521 articles** répertoriés avec références exactes, désignations complètes, tarifs unitaires HT et catégories.
* **168 pages officielles** du catalogue Proscom 2026 cartographiées individuellement (incluant les additifs web `28 B`, `29 B`, `42 B`, `43 B`).
* Prise en charge des variantes de capacités (ex. Clés USB 32 Go vs 64 Go) et de dimensions (ex. Trophées 20 cm vs 22 cm vs 24 cm).

### 2. 📄 Détection Intelligente de la Page PDF (Lecteur Chrome & PDF.js)
* **Détection du lecteur Chrome (PDFium)** : exploration récursive des Shadow DOM (`viewer-pdf-toolbar-new`, `viewer-toolbar`, `viewer-page-selector`, `#page-input`).
* **Moteur de Déduction par Référence** : même si le lecteur masque son compteur de page, l'extension analyse les références visibles à l'écran (ex: `24-26`) et en déduit immédiatement la page correspondante (ex: Page 14) pour afficher ses articles en tête de liste.
* Boutons de saut direct vers les chapitres clés (*Thermos, Coffrets, Carnets, Stylos, High-Tech, Sacs, Trophées, Promotions*).
* Recherche directe par page dans la barre principale (ex: `page 24` ou `p24`).

### 3. 💼 Marge Commerciale Revendeur Persistante
* Définition d'un taux de marge revendeur en % avec répercussion instantanée sur les prix de vente conseillés HT et TTC.
* **Sauvegarde permanente** (double couche `localStorage` + `chrome.storage.local`) conservée jusqu'à modification manuelle.

### 4. 🛒 Devis & Panier Rapide Persistant
* Sauvegarde automatique du panier et du nom client jusqu'à suppression manuelle (avec boîte de confirmation sécurisée).
* Calculs en temps réel : Total Brut HT, Marge Revendeur, Total Revente HT, TVA 19%, Total TTC.
* Bouton **Copier le Devis** générant un texte propre et professionnel prêt à coller par email ou WhatsApp.

### 5. 🖱️ Menu Contextuel & Raccourcis Clavier
* Clic droit sur n'importe quel texte ou référence dans Chrome → *« Chercher le prix Proscom pour « ... » »*.
* Clic droit sur la page du PDF → *« 📄 Ouvrir les prix Proscom de cette page »*.
* Raccourci clavier d'ouverture instantanée : `Ctrl+Shift+P` (ou `Cmd+Shift+P` sur Mac).

---

## 🚀 Installation dans Google Chrome

1. Clonez ce dépôt ou téléchargez le code source :
   ```bash
   git clone https://github.com/mmediouni/ctx-proscom-prices-catalogue-2026.git
   ```
2. Ouvrez Google Chrome et accédez à :
   `chrome://extensions/`
3. Activez le **« Mode développeur »** en haut à droite.
4. Cliquez sur **« Charger l'extension non empaquetée »** et sélectionnez ce dossier.
5. *(Recommandé pour les PDF locaux sur votre PC)* :
   * Cliquez sur **Détails** sous l'extension Proscom.
   * Cochez l'option **« Autoriser l'accès aux URL de fichiers »**.

---

## 🛠️ Structure du Projet

```
├── manifest.json       # Configuration Manifest V3 (permissions, raccourcis, worker)
├── popup.html          # Interface utilisateur moderne et intuitive
├── popup.css           # Système de design soigné avec support Dark Mode
├── popup.js            # Logique applicative, moteur de recherche et détection PDF
├── produits.js         # Base de données exhaustive des 521 produits 2026
├── background.js       # Service worker et gestion des menus contextuels
└── README.md           # Documentation officielle
```

---

## 🏢 Licence & Crédits
Développé pour **Cadeauette TN** - Catalogue Fournisseur Proscom 2026.
