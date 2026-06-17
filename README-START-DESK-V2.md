# Start Desk v2

Cette version garde la base existante de la page de démarrage et ajoute une couche d’usage plus quotidienne.

## Principes

- Focus activé par défaut.
- Profil Silex activé par défaut.
- Les favoris restent centrés et responsives.
- Les modules secondaires ne sont plus imposés à l’écran : ils sont accessibles via le dock.

## Nouveautés v2

- Panneau `Apps` : accès à tous les favoris sans quitter le mode focus.
- Panneau `Notes` : notes locales sauvegardées dans le navigateur.
- Panneau `Agenda` : aperçu du module calendrier et bouton vers Google Agenda.
- Panneau `Réglages` : profils, focus et densité accessibles sans ouvrir le panneau avancé.
- Panneau `?` : aide intégrée.
- Raccourcis clavier :
  - `Cmd/Ctrl + K` : revenir à la recherche.
  - `/` : focus recherche depuis la page.
  - `Esc` : fermer le panneau Start Desk.
- Placeholder dynamique dans la barre de recherche.

## Commandes Spotlight utiles

- `silex`, `focus`, `code`, `perso`, `complet`
- `apps`, `notes`, `aide`
- `g budget Silex`
- `ai reformule ce mail`
- `cal AG Silex`
- `drive rapport moral`
- `gh homepage`
- `mail`, `agenda`, `drive`, `dolibarr`, `chatgpt`

## Fichiers principaux à remplacer

- `js/start-desk.js`
- `css/start-desk.css`
- `js/startpage-config.js`

Les autres fichiers sont conservés.
