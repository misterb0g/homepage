# 🌐 Homepage personnalisée

Une page d’accueil personnalisée pour navigateur (Mac + iPhone), avec :
- Grille responsive de favoris (4 colonnes desktop → 3 / 2 / 1 en mobile).
- Thème clair/sombre auto via `prefers-color-scheme`.
- Switch manuel clair/sombre (avec persistance en `localStorage`).
- Affichage de l’heure et de la météo.

## 🚀 Mise en ligne avec GitHub Pages

### 1. Préparer les fichiers
Ce dépôt contient :
- `index.html`
- `styles.css`
- `bookmarks.js`
- (optionnel) `favicon.png`

### 2. Déployer sur GitHub Pages
1. Aller dans **Settings** > **Pages**.
2. Dans *Build and deployment* :
   - **Source** = *Deploy from a branch*  
   - **Branch** = `main` → `/ (root)`
3. Sauvegarder → GitHub va générer le site.

### 3. Accéder à la page
Ton URL sera de la forme : https://misterb0g.github.io/homepage/

### 4. Utiliser sur Mac
- Safari > Réglages > Général > Page d’accueil → colle l’URL GitHub Pages.

### 5. Utiliser sur iPhone
1. Ouvrir Safari → aller sur l’URL.
2. Appuyer sur **Partager** → **Sur l’écran d’accueil**.
3. Une icône “app” apparaît, ouvrant directement la page d’accueil.

## 🛠️ Personnalisation

- Les favoris se modifient dans `bookmarks.js`.
- Le style (colonnes, switch, couleurs) est dans `styles.css`.
- Les thèmes clair/sombre peuvent être forcés en ajoutant à `<html>` :
  ```html
  <html lang="fr" data-theme="light">
  <!-- ou -->
  <html lang="fr" data-theme="dark">