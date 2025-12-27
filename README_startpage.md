# Startpage (Safari) – Documentation

Cette startpage est une page statique (HTML/CSS/JS) servie par **Vercel**, versionnée sur **GitHub**.  
Objectif : une “Spotlight page” très rapide orientée boulot (favoris, météo, recherche, news, chat).

## Architecture (fichiers)

- `index.html` : UI + logique (météo, recherche, panneau paramètres, drag & drop, préférences localStorage).
- `styles.css` : design (glass / macOS-ish), thèmes Jour/Nuit/Auto, densité, animations.
- `bookmarks.js` : contenu des favoris (tuiles + liens).
- `/api/news` + `/api/lesoir` : proxies RSS (Google News) avec cache, évite CORS.
- `/api/chat` : proxy OpenAI (clé côté serveur).
- `/api/gemini` : proxy Gemini (clé côté serveur).

## Déploiement (GitHub → Vercel)

1. Repo GitHub : code + assets.
2. Projet Vercel lié au repo.
3. Déploiement automatique à chaque push sur la branche de prod.

### Variables d’environnement Vercel

- `OPENAI_API_KEY` : utilisé par `/api/chat`
- `GEMINI_API_KEY` : utilisé par `/api/gemini`

⚠️ Les clés restent côté Vercel (jamais dans `index.html`).

## Développement local

Pour tester la page rapidement :

```bash
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

Pour tester les functions Vercel localement : Vercel CLI (optionnel).

## Préférences (localStorage)

- `theme` : `system` | `light` | `dark`
- `showChat` : `'false'` par défaut (chat masqué)
- `weatherLocation` : ex. `Brussels`
- `startpage_tile_order_v1` : ordre des tuiles
- `startpage_search_default_engine_v1` : moteur choisi

## Modifier les favoris

Éditer `bookmarks.js` (source de vérité).

## “Primary tiles”

Les 3 tuiles accentuées (halo + un peu plus large) :
- **Ressources Humaines**
- **Banques & Finance**
- **Administration**

Le CSS cible les titres via `data-tile-title`. Si tu renommes une tuile, adapte le bloc `PRIMARY TILES`.

## Ce que je “nettoie” en ~5% (sans tout casser)

- Un seul bloc CSS “Engine selector” (lisibilité + icône active + micro-animation).
- Normalisation des sélecteurs sombre via `:root[data-theme="dark"]`.
- Placeholder de recherche ciblé uniquement sur `#search-input` (évite l’effet domino).
- Focus keeper “Spotlight” ajouté **sans** réécrire tes handlers existants (moins de risque).

## Debug rapide quand un module “disparaît”

- Console Safari : une erreur JS peut stopper le rendu des favoris.
- Vérifier que `bookmarks.js` est chargé (pas de 404).
- Tester en navigation privée (cache / localStorage propres).
- Vider `startpage_tile_order_v1` si les tuiles ont un ordre bizarre.
