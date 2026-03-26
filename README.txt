# Homepage refactor local test

Cette version est un refactor prudent :
- même HTML/CSS/JS fonctionnel
- script inline extrait en modules
- mêmes IDs, classes et clés localStorage
- aucun changement visuel volontaire

## Structure
- index.html
- styles.css
- js/
  - core.js
  - weather.js
  - bookmarks-ui.js
  - news.js
  - search.js
  - chat.js
  - settings.js
  - widgets.js
  - calendar.js
  - app.js

## À copier depuis ton projet actuel
- bookmarks.js
- éventuellement /api/calendar.js si tu testes aussi l'agenda

## Ordre de test recommandé
1. météo
2. calendrier
3. actualités
4. chat
5. réglages
6. modes compact/dashboard
7. redimensionnement News/Chat


## Refactor CSS prudent
Le CSS a été refactoré de manière conservatrice :
- `styles.css` devient le point d’entrée
- `css/legacy.css` contient l’intégralité du CSS actuel, inchangé
- les autres fichiers `css/*.css` sont prêts pour une migration progressive

### Pourquoi cette méthode
- zéro risque visuel immédiat
- même rendu attendu
- base propre pour déplacer ensuite les règles par section

### Méthode recommandée
Déplacer progressivement depuis `css/legacy.css` vers :
- `variables.css`
- `layout.css`
- `widgets.css`
- `weather.css`
- `search.css`
- `bookmarks.css`
- `calendar.css`
- `news.css`
- `chat.css`
- `settings.css`
- `modes.css`
- `animations.css`

Déplacer bloc par bloc, tester, puis supprimer du `legacy.css`.
