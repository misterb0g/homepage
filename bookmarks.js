@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro&display=swap');

/* =========================
   Variables de thème
   ========================= */

/* Thème sombre (défaut) */
:root,
:root[data-theme="dark"] {
  --bg: #2c4a54;
  --fg: #ffffff;
  --secondaryFg: #b3b3b3;
  --containerBg: #272727;
  --searchBg: var(--containerBg);
  --scrollbarColor: #3f3f3f;
  --fontFamily: 'Source Sans Pro', sans-serif;
}

/* Thème clair forcé */
:root[data-theme="light"] {
  --bg: #f2f2f2;
  --fg: #222222;
  --secondaryFg: #555555;
  --containerBg: #ffffff;
  --searchBg: #eaeaea;
  --scrollbarColor: #cccccc;
}

/* Auto: suit les préférences système si pas de data-theme */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #f2f2f2;
    --fg: #222222;
    --secondaryFg: #555555;
    --containerBg: #ffffff;
    --searchBg: #eaeaea;
    --scrollbarColor: #cccccc;
  }
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #2c4a54;
    --fg: #ffffff;
    --secondaryFg: #b3b3b3;
    --containerBg: #272727;
    --searchBg: var(--containerBg);
    --scrollbarColor: #3f3f3f;
  }
}

/* =========================
   Layout général
   ========================= */
html, body {
  height: 100%;
}
body {
  background-color: var(--bg);
  margin: 0;
}

.container {
  width: 100%;
  min-height: 100vh;
  padding: 2em 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-direction: column;
  box-sizing: border-box;
}

#clock {
  font-family: var(--fontFamily);
  font-size: 3.2rem;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 0.5em;
}

/* =========================
   Météo
   ========================= */
.weather-container {
  width: min(600px, 90%);
  background-color: var(--containerBg);
  padding: 1em;
  border-radius: 10px;
  font-family: var(--fontFamily);
  color: var(--fg);
  text-align: center;
  box-sizing: border-box;
}
.inline { display: inline-block; }

/* =========================
   Barre de recherche (plus bas & plus grande)
   ========================= */
.quick-search {
  margin: 2em auto 2em;              /* espace plus grand */
  width: min(700px, 92%);            /* largeur max augmentée */
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75em;
  box-sizing: border-box;
}

.quick-search input[type="search"] {
  padding: 1em 1.2em;                /* champ plus grand */
  border: none;
  border-radius: 12px;
  background: var(--containerBg);
  color: var(--fg);
  font-family: var(--fontFamily);
  font-size: 1.2rem;                 /* texte plus gros */
  outline: none;
}

.quick-search button {
  padding: 1em 1.4em;                /* bouton plus grand */
  border: none;
  border-radius: 12px;
  background: var(--fg);
  color: var(--bg);
  font-family: var(--fontFamily);
  font-size: 1.1rem;
  cursor: pointer;
  transition: filter .2s ease, transform .05s ease;
}
.quick-search button:hover { filter: brightness(0.9); }
.quick-search button:active { transform: translateY(1px); }

@media (max-width: 600px) {
  .quick-search {
    grid-template-columns: 1fr;
  }
}

/* =========================
   Bookmarks : grille 4 colonnes
   ========================= */
#bookmark-container {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 1em;
  justify-content: center;
  width: min(1400px, 92%);
  margin: 0 auto 2em;
  box-sizing: border-box;
  align-items: stretch;
}

.bookmark-set {
  padding: 1em;
  background-color: var(--containerBg);
  border-radius: 10px;
  font-family: var(--fontFamily);
  font-size: 0.95rem;
  height: 12em;
  box-sizing: border-box;
}

.bookmark-inner-container {
  overflow-y: auto;
  height: 80%;
  vertical-align: top;
  padding-right: 6px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbarColor) #ffffff00;
}
.bookmark-inner-container::-webkit-scrollbar { width: 6px; }
.bookmark-inner-container::-webkit-scrollbar-track { background: #ffffff00; }
.bookmark-inner-container::-webkit-scrollbar-thumb {
  background-color: var(--scrollbarColor);
  border-radius: 6px;
  border: 3px solid #ffffff00;
}

.bookmark-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0 0 0.35em 0;
}
.bookmark {
  text-decoration: none;
  color: var(--secondaryFg);
  display: block;
  margin: 0.5em 0;
}
.bookmark:hover { color: var(--fg); }

/* Rangées complètes visuelles (placeholders) */
#bookmark-container::after {
  content: "";
  display: block;
  height: 0;
  visibility: hidden;
}
#bookmark-container:has(> :last-child:nth-child(4n+1))::after { grid-column: span 3; }
#bookmark-container:has(> :last-child:nth-child(4n+2))::after { grid-column: span 2; }
#bookmark-container:has(> :last-child:nth-child(4n+3))::after { grid-column: span 1; }

/* Responsive */
@media (max-width: 1280px) {
  #bookmark-container {
    grid-template-columns: repeat(3, minmax(180px, 1fr));
    width: min(1200px, 92%);
  }
  #bookmark-container::after { grid-column: auto; }
  #bookmark-container:has(> :last-child:nth-child(3n+1))::after { grid-column: span 2; }
  #bookmark-container:has(> :last-child:nth-child(3n+2))::after { grid-column: span 1; }
}
@media (max-width: 960px) {
  #bookmark-container {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
    width: 92%;
  }
  #bookmark-container::after { grid-column: auto; }
  #bookmark-container:has(> :last-child:nth-child(2n+1))::after { grid-column: span 1; }
  .bookmark-set { height: auto; }
}
@media (max-width: 600px) {
  #bookmark-container {
    grid-template-columns: 1fr;
    width: 94%;
  }
  #bookmark-container::after { display: none; }
}

/* =========================
   Switch clair/sombre (mini)
   ========================= */
.switch {
  position: fixed;
  top: 1em;
  right: 1em;
  display: inline-block;
  width: 40px;   /* mini */
  height: 20px;  /* mini */
  z-index: 1000;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--secondaryFg);
  transition: 0.3s;
  border-radius: 20px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: var(--containerBg);
  transition: 0.3s;
  border-radius: 50%;
}
input:checked + .slider { background-color: var(--fg); }
input:checked + .slider:before { transform: translateX(20px); }
