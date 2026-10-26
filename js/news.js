    // --- NEWS: Fonction générique pour charger un flux ---
    async function fetchAndRenderNews(apiUrl, listId) {
        const list = $(listId);
        if (!list) return false;
        try {
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
            
            const xmlText = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            if (xmlDoc.querySelector('parsererror')) throw new Error('Flux RSS invalide');
            
            // Récupération et tri des items (plus récent en haut)
            let items = Array.from(xmlDoc.querySelectorAll("item"));
            items.sort((a, b) => {
                const dateA = new Date(a.querySelector("pubDate")?.textContent);
                const dateB = new Date(b.querySelector("pubDate")?.textContent);
                return dateB - dateA; // Décroissant
            });

            // On garde les 5 premiers pour chaque colonne
            items = items.slice(0, 5);

            if (items.length > 0) {
                list.innerHTML = items.map(item => {
                    const title = item.querySelector("title")?.textContent || "Sans titre";
                    const link = item.querySelector("link")?.textContent || "#";
                    const pubDateRaw = item.querySelector("pubDate")?.textContent;
                    
                    let dateStr = "";
                    if (pubDateRaw) {
                        dateStr = new Date(pubDateRaw).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
                    }

                    return `
                    <a href="${link}" target="_blank" rel="noopener" style="text-decoration: none; color: inherit; display: block;">
                        <article class="bookmark" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.3rem; line-height: 1.4;">${title}</div>
                            <div style="font-size: 0.75rem; color: var(--secondaryFg); text-align: right;">${dateStr}</div>
                        </article>
                    </a>`;
                }).join('');
            } else {
                list.innerHTML = `<div style="font-size:0.8rem; opacity:0.7">Aucun article.</div>`;
            }
            return true;
        } catch (e) {
            console.error(`Erreur chargement news (${apiUrl}):`, e);
            list.innerHTML = `<div style="font-size:0.8rem; color:var(--errorFg)">Erreur chargement.</div>`;
            return false;
        }
    }

    // --- Chargement global des news ---
    let __newsLoaded = false;
    let newsLoadPromise = null;
    let newsRetryTimer = null;
    let newsRetryCount = 0;
    const NEWS_RETRY_DELAYS_MS = [2500, 8000];

    function scheduleNewsRetry() {
        if (newsRetryTimer || newsRetryCount >= NEWS_RETRY_DELAYS_MS.length) return;
        const delay = NEWS_RETRY_DELAYS_MS[newsRetryCount];
        newsRetryCount += 1;
        newsRetryTimer = window.setTimeout(() => {
            newsRetryTimer = null;
            if (navigator.onLine !== false &&
                localStorage.getItem('showNews') !== 'false' &&
                !document.body.classList.contains('focus-mode')) {
                loadNews({ force: true });
            }
        }, delay);
    }

    async function loadNews({ force = false } = {}) {
        if (__newsLoaded && !force) return true;
        if (newsLoadPromise) return newsLoadPromise;
        const container = $('#news-container');

        window.__newsLoaded = false;
        newsLoadPromise = Promise.all([
            fetchAndRenderNews('/api/news', '#macg-list'),
            fetchAndRenderNews('/api/lesoir', '#lesoir-list')
        ]).then((results) => {
            __newsLoaded = results.every(Boolean);
            window.__newsLoaded = __newsLoaded;
            if (__newsLoaded) newsRetryCount = 0;
            else scheduleNewsRetry();
            return __newsLoaded;
        }).finally(() => {
            newsLoadPromise = null;
        });

        // Affichage du bloc si l'option est activée et que Focus est désactivé.
        if (container && localStorage.getItem('showNews') !== 'false' &&
            !document.body.classList.contains('focus-mode')) {
            container.style.display = 'block';
        }

        return newsLoadPromise;
    }

    window.addEventListener('online', () => {
        if (!__newsLoaded) loadNews({ force: true });
    });

