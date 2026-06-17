# Start Desk v3.1 — statistiques locales des favoris

Cette version reprend la v3 et ajoute un suivi local d’usage des favoris.

## Ajouts

- Enregistrement local de chaque clic sur un favori.
- Statistiques stockées uniquement dans `localStorage.startdesk_usage_stats_v1`.
- Panneau Stats accessible via Spotlight : `stats`, `statistiques` ou `usage`.
- Raccourci clavier : `U` pour ouvrir/fermer les statistiques.
- Commandes de réinitialisation : `reset stats`, `vider stats`, `réinitialiser stats`.
- Classement : très utilisés, peu utilisés, jamais utilisés.

## Important

Les statistiques commencent uniquement après installation de cette version. Les favoris indiqués comme “jamais utilisés” le sont donc depuis l’activation de la v3.1 dans le navigateur courant.

Aucune donnée n’est envoyée à un serveur.

## Fichiers à remplacer

- `index.html`
- `js/startpage-config.js`
- `js/startpage-plus.js`
- `js/start-desk.js`
- `css/start-desk.css`

## Fichier optionnel

- `README-START-DESK-V31.md`
