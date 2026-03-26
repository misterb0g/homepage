// --- Favoris ---
    function setupBookmarks() {
      if (typeof bookmarks === 'undefined') return;

      // Tri A→Z des liens dans chaque tuile
      bookmarks.forEach(category => { category.links.sort((a, b) => a.name.localeCompare(b.name)); });

      // Applique l’ordre mémorisé (si présent)
      const order = loadTileOrder();
      if (order && order.length) {
        const byTitle = new Map(bookmarks.map(b => [b.title, b]));
        const ordered = [];
        order.forEach(t => { if (byTitle.has(t)) ordered.push(byTitle.get(t)); });
        // Ajoute ce qui n’est pas encore dans l’ordre (nouvelles tuiles)
        bookmarks.forEach(b => { if (!order.includes(b.title)) ordered.push(b); });
        // Remplace en place (pour éviter de casser les refs ailleurs)
        bookmarks.length = 0;
        ordered.forEach(b => bookmarks.push(b));
      }

      const el = $("#bookmark-container");
      el.innerHTML = bookmarks.map((b, index) => `
        <section class="bookmark-set card glass" data-tile-title="${escapeHtml(b.title)}" style="animation-delay: ${200 + (index * 100)}ms">
          <div class="bookmark-header">
            <div class="bookmark-title">${escapeHtml(b.title)}</div>
            <button class="tile-handle" type="button" aria-label="Déplacer la tuile" title="Déplacer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5.5A1.5 1.5 0 1 1 7.5 4 1.5 1.5 0 0 1 9 5.5Zm0 6A1.5 1.5 0 1 1 7.5 10 1.5 1.5 0 0 1 9 11.5Zm0 6A1.5 1.5 0 1 1 7.5 16 1.5 1.5 0 0 1 9 17.5ZM16.5 7A1.5 1.5 0 1 1 18 5.5 1.5 1.5 0 0 1 16.5 7Zm0 6A1.5 1.5 0 1 1 18 11.5 1.5 1.5 0 0 1 16.5 13Zm0 6A1.5 1.5 0 1 1 18 17.5 1.5 1.5 0 0 1 16.5 19Z"></path>
              </svg>
            </button>
          </div>
          <div class="bookmark-inner-container">
            ${b.links.map(l => `<a class="bookmark" href="${l.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.name)}</a>`).join("")}
          </div>
        </section>`).join("");

      initTileSortable();
    }
