# Homepage perso – Guide rapide (Gilles)

Page d’accueil minimaliste et rapide : horloge, météo Bruxelles (résumé + prévisions 5 jours), barre de recherche Google façon Spotlight, favoris (depuis `bookmarks.js`), chat GPT en **streaming**, thème clair/sombre, **toggle de densité** (compact/spacieux), et sous-domaine perso (OVH).

## Sommaire
- [Aperçu](#aperçu)
- [Structure du projet](#structure-du-projet)
- [Installation & Déploiement Vercel](#installation--déploiement-vercel)
- [Variables d’environnement](#variables-denvironnement)
- [API ChatGPT](#api-chatgpt)
- [Front-end](#front-end)
- [DNS OVH → Vercel (sous-domaine)](#dns-ovh--vercel-sous-domaine)
- [Tests & Debug](#tests--debug)
- [Personnalisation](#personnalisation)
- [FAQ](#faq)

---

## Aperçu
- **`index.html`** : structure + JS inline (horloge, météo, Spotlight, favoris, ChatGPT, densité, stats locales).
- **`styles.css`** : thème macOS-like, glassmorphism (reflets + blur), responsive, transitions douces.
- **`bookmarks.js`** : définition des colonnes et liens (affichage automatique).
- **`/api/chat.js`** : proxy **Edge** Vercel vers OpenAI *Responses API* en **stream**, avec conversion SSE → **texte brut** (facile côté front).

---

## Structure du projet
/api/chat.js           # Endpoint Edge (stream SSE -> texte)
index.html
styles.css
bookmarks.js
README.md

> Important : le dossier `api/` est **à la racine** du repo pour que Vercel crée la route `/api/chat`.

---

## Installation & Déploiement Vercel

### 1) Repo GitHub
- Mets tous les fichiers à la racine.
- Commit & push sur la branche que tu déploies (souvent `main`).

### 2) Projet Vercel (Git Import)
- Dans le dashboard Vercel → **New Project** → **Import Git Repository**.
- Sélectionne ce repo → *Deploy*.
- À chaque **push Git**, Vercel redéploie automatiquement (CI/CD).

### 3) Production vs Preview
- Branche `main` = **Production** (URL stable).
- Chaque commit/diff peut aussi générer une **Preview URL** (pratique pour tester).

---

## Variables d’environnement
- Aller dans **Vercel → Project → Settings → Environment Variables** :
  - **Name** : `OPENAI_API_KEY`
  - **Value** : `sk-...` (clé API OpenAI)
  - **Environment** : **Production** (et Preview si besoin)
- **Redeploy** après ajout ou modification.

> Rappel : **ChatGPT Plus ≠ crédits API**. L’API OpenAI est **facturée à l’usage**. Activer la facturation sur <https://platform.openai.com/account/billing/overview>.

---

## API ChatGPT

### Endpoint
- `POST /api/chat` – **streaming** (SSE OpenAI transformé en **texte**)

### Modèle par défaut
- `gpt-4o-mini` (rapide / économique).  
  > Modifiable dans `/api/chat.js` : `model: 'gpt-4o-mini'`.

### Test rapide (terminal)
```bash
curl -i -X POST https://<ton-projet>.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Bonjour !"}'
  
  	•	En streaming, la réponse est du texte incrémental (concaténable côté front).
	•	Pour un test non-stream (debug), on peut prévoir un endpoint alternatif (voir FAQ).

⸻

Front-end

Fonctionnalités clés
	•	Switch clair/sombre (persisté localStorage, auto fallback prefers-color-scheme).
	•	Toggle de densité (icône “A ↕︎”, aligné au switch, persistant).
	•	Météo (Open-Meteo) :
	•	Résumé actuel (température + libellé),
	•	Clic sur la carte → prévisions 5 jours (chargées à la demande).
	•	Spotlight Google :
	•	raccourcis / et ⌘K/Ctrl+K pour focus.
	•	Favoris depuis bookmarks.js (texte sobre).
	•	ChatGPT :
	•	envoi du prompt, réception stream (texte brut), mise à jour en direct.
	•	Stats locales :
	•	Réseau (toujours, avec fallback on/offline),
	•	Batterie et Mémoire affichées uniquement si supportées (masquées sinon).

Si la page n’est pas servie par Vercel
	•	Dans index.html, remplace fetch('/api/chat') par l’URL complète :
		
		fetch('https://<ton-projet>.vercel.app/api/chat', {...})
		
		DNS OVH → Vercel (sous-domaine)

Objectif : start.bogarts.be (sans toucher bogarts.be).
	1.	Vercel → Project → Settings → Domains → Add
	•	Ajoute start.bogarts.be.
	•	Vercel affiche la cible CNAME (souvent cname.vercel-dns.com).
	2.	OVH → Domaines → bogarts.be → Zone DNS
	•	Ajouter un enregistrement CNAME :
	•	Sous-domaine : start
	•	Cible : la cible donnée par Vercel (ou ns1.vercel-dns.com selon config).
	•	Supprimer toute entrée A/AAAA existante pour start (conflit).
	3.	Propagation
	•	Quelques minutes à quelques heures.
	•	Vérif :
		nslookup start.bogarts.be
		
	Tests & Debug

Vérifier l’API côté Vercel
	•	Deployments → Logs : erreurs 500, 401, etc.
	•	Erreurs courantes :
	•	OPENAI_API_KEY manquant → variable non définie en Production.
	•	insufficient_quota → pas de crédits API → configurer la facturation.
	•	404 sur /api/chat → vérifier /api/chat.js à la racine du repo.
	•	CORS si page servie ailleurs → appeler l’URL complète (et éventuellement restreindre Access-Control-Allow-Origin dans /api/chat.js).

Diagnostic côté front (non-stream)
	•	Alternative : endpoint JSON non-stream pour remonter l’erreur proprement (voir FAQ).
	•	Afficher le status et await res.text() en cas de !res.ok.

⸻

Personnalisation

Modèle OpenAI
Dans /api/chat.js :
model: 'gpt-4o-mini' // changer par 'gpt-4.1-mini', 'gpt-4.1', etc.

CORS (resserrer la sécurité)

Dans /api/chat.js, remplacer :
'Access-Control-Allow-Origin': '*',
par :
'Access-Control-Allow-Origin': 'https://start.bogarts.be',
(et ajuster pour Preview si besoin).

Thème & densité (CSS)
	•	Variables dans :root et :root[data-density="..."] (--pad-card, --spot-h, --radius, etc.).

Favoris
	•	Éditer bookmarks.js (titres/sections/liens) → le rendu est auto.

⸻

FAQ

Q. ChatGPT “ne répond pas” ou “Oups” côté front ?
R. 1) Vérifier que fetch vise la bonne URL (/api/chat sans .js).
2) Checker Deployments → Logs.
3) Tester l’API en curl (ci-dessus).
4) Valider OPENAI_API_KEY + facturation API.

Q. Je veux un fallback JSON non-stream pour déboguer.
R. Deux options simples :
	•	Endpoint dédié /api/chat-json.js (retour { reply: "..." }).
	•	Ou switch dans /api/chat.js avec ?mode=json.

Q. Puis-je changer l’URL Vercel ?
R. Oui. Settings → General → Project Name (pour *.vercel.app) ou Settings → Domains pour ajouter un domaine/sous-domaine perso.

Q. Faire de start.bogarts.be ma page d’accueil Mac/iPhone ?
R. Oui. Safari/Chrome/Firefox → Préférences → Au démarrage → Page d’accueil = l’URL.
Sur iOS, tu peux aussi Ajouter à l’écran d’accueil pour un accès direct.

⸻

Licence

Projet perso de page d’accueil. Libre d’usage interne 