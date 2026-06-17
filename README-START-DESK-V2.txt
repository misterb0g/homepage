Start Desk v2 — 17/06/2026

Objectif
- Garder la page existante, mais rendre le mode Focus/Silex plus central, plus propre et plus rapide.

Principales évolutions
- Profil Silex par défaut, en mode Focus.
- Profils disponibles : Silex, Focus, Code, Perso, Complet.
- Dock inférieur enrichi : Focus, Silex, Code, Apps, Agenda, Notes, Réglages.
- Commandes Spotlight : g, ai/ia, cal, drive, gh + alias favoris.
- Palette Spotlight enrichie avec suggestions de commandes et de recherches préfixées.
- Raccourcis clavier :
  - Cmd/Ctrl + K : focus sur la barre de recherche
  - / : focus sur la barre de recherche
  - F : profil Focus
  - S : profil Silex
  - C : profil Code
  - A : Apps / Complet
  - N : Notes rapides
  - Esc : fermer les notes / quitter la recherche
- Notes rapides sauvegardées localement via localStorage.
- Meilleure bascule entre profils : le mode Complet réaffiche les modules utiles.

Fichiers principalement modifiés/ajoutés
- index.html
- js/startpage-config.js
- js/startpage-plus.js
- js/start-desk.js
- css/start-desk.css

Intégration GitHub
- Remplacer les fichiers ci-dessus dans le repo.
- Les autres fichiers peuvent rester inchangés.
- Vercel devrait redéployer automatiquement si le repo est connecté.
