// --- Mini calendrier intégré + événements Google Calendar via /api/calendar ---
    (function () {
      const grid = document.getElementById('calendar-grid');
      const label = document.getElementById('calendar-month-label');
      const prev = document.getElementById('calendar-prev');
      const next = document.getElementById('calendar-next');
      const eventsList = document.getElementById('calendar-events');
      const selectedLabel = document.getElementById('calendar-selected-label');
      const resetSelectionBtn = document.getElementById('calendar-reset-selection');
      if (!grid || !label || !prev || !next || !eventsList) return;

      let current = new Date();
      current.setDate(1);

      let loadedEvents = [];
      let selectedDateKey = null;

      const monthFmt = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' });
      const dateFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
      const fullDateFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeFmt = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

      function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }

      function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      }

      function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function getEventDateKey(event) {
        const start = new Date(event.start);
        return toDateKey(start);
      }

      function hasEventsOnDate(dateKey) {
        return loadedEvents.some(event => getEventDateKey(event) === dateKey);
      }

      function updateSelectionUi() {
        grid.querySelectorAll('.calendar-day').forEach((btn) => {
          btn.classList.toggle('is-selected', btn.dataset.dateKey === selectedDateKey);
        });

        if (selectedDateKey) {
          const selectedDate = new Date(selectedDateKey + 'T12:00:00');
          selectedLabel.hidden = false;
          selectedLabel.textContent = fullDateFmt.format(selectedDate);
          resetSelectionBtn.hidden = false;
        } else {
          selectedLabel.hidden = true;
          selectedLabel.textContent = '';
          resetSelectionBtn.hidden = true;
        }
      }

      function renderCalendar() {
        const year = current.getFullYear();
        const month = current.getMonth();

        const firstDay = new Date(year, month, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        label.textContent = monthFmt.format(firstDay);

        const today = new Date();
        const cells = [];

        for (let i = 0; i < startOffset; i++) {
          const day = daysInPrevMonth - startOffset + i + 1;
          const date = new Date(year, month - 1, day);
          cells.push({
            day,
            outside: true,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date))
          });
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          cells.push({
            day: d,
            outside: false,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date)),
            today:
              d === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear()
          });
        }

        while (cells.length % 7 !== 0) {
          const overflowDay = cells.length - (startOffset + daysInMonth) + 1;
          const date = new Date(year, month + 1, overflowDay);
          cells.push({
            day: overflowDay,
            outside: true,
            dateKey: toDateKey(date),
            hasEvents: hasEventsOnDate(toDateKey(date))
          });
        }

        grid.innerHTML = cells.map(cell => `
          <button
            type="button"
            class="calendar-day${cell.outside ? ' is-outside' : ''}${cell.today ? ' is-today' : ''}${cell.hasEvents ? ' has-events' : ''}"
            data-date-key="${cell.dateKey}"
            aria-pressed="${selectedDateKey === cell.dateKey ? 'true' : 'false'}"
          >
            <span>${cell.day}</span>
            ${cell.hasEvents ? '<i class="calendar-day-dot" aria-hidden="true"></i>' : ''}
          </button>
        `).join('');

        grid.querySelectorAll('.calendar-day').forEach((btn) => {
          btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const clickedKey = btn.dataset.dateKey;
            selectedDateKey = (selectedDateKey === clickedKey) ? null : clickedKey;
            updateSelectionUi();
            renderEvents();
          });
        });

        updateSelectionUi();
      }

      function getEventIcon(event) {
        const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
        if (event.allDay) return '○';
        if (text.includes('meet') || text.includes('réunion') || text.includes('meeting') || text.includes('teams') || text.includes('zoom')) return '●';
        if (text.includes('trajet') || text.includes('déplacement') || text.includes('train') || text.includes('vol')) return '◆';
        return '•';
      }

      function formatEvent(event) {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        const allDay = !!event.allDay;

        const dateLabel = dateFmt.format(start);
        const timeLabel = allDay
          ? 'Toute la journée'
          : `${timeFmt.format(start)}${end ? ` – ${timeFmt.format(end)}` : ''}`;

        const wrapperTag = event.url ? 'a' : 'article';
        const wrapperAttrs = event.url
          ? `href="${event.url}" target="_blank" rel="noopener noreferrer" class="calendar-event-item is-link"`
          : `class="calendar-event-item"`;

        return `
          <${wrapperTag} ${wrapperAttrs}>
            <div class="calendar-event-icon" aria-hidden="true">${getEventIcon(event)}</div>
            <div class="calendar-event-main">
              <div class="calendar-event-name">${event.title || 'Événement'}</div>
              <div class="calendar-event-meta">${dateLabel} · ${timeLabel}</div>
            </div>
          </${wrapperTag}>
        `;
      }

      function renderSelectedDateEvents() {
        const selectedEvents = loadedEvents.filter(event => getEventDateKey(event) === selectedDateKey);
        if (!selectedEvents.length) {
          eventsList.innerHTML = '<div class="calendar-event-empty">Aucun événement ce jour-là.</div>';
          return;
        }

        eventsList.innerHTML = `
          <section class="calendar-event-group">
            <div class="calendar-event-group-title">Événements du jour</div>
            <div class="calendar-event-group-list">
              ${selectedEvents.map(formatEvent).join('')}
            </div>
          </section>
        `;
      }

      function renderGroupedEvents() {
        if (!Array.isArray(loadedEvents) || loadedEvents.length === 0) {
          eventsList.innerHTML = '<div class="calendar-event-empty">Aucun événement à venir.</div>';
          return;
        }

        const today = startOfDay(new Date());
        const tomorrow = addDays(today, 1);

        const buckets = {
          today: [],
          tomorrow: [],
          later: []
        };

        loadedEvents.forEach((event) => {
          const start = new Date(event.start);
          const eventDay = startOfDay(start);
          if (eventDay.getTime() === today.getTime()) buckets.today.push(event);
          else if (eventDay.getTime() === tomorrow.getTime()) buckets.tomorrow.push(event);
          else buckets.later.push(event);
        });

        const sections = [];

        if (buckets.today.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">Aujourd’hui</div>
              <div class="calendar-event-group-list">
                ${buckets.today.map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        if (buckets.tomorrow.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">Demain</div>
              <div class="calendar-event-group-list">
                ${buckets.tomorrow.map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        if (buckets.later.length) {
          sections.push(`
            <section class="calendar-event-group">
              <div class="calendar-event-group-title">À venir</div>
              <div class="calendar-event-group-list">
                ${buckets.later.slice(0, 4).map(formatEvent).join('')}
              </div>
            </section>
          `);
        }

        eventsList.innerHTML = sections.join('') || '<div class="calendar-event-empty">Aucun événement à venir.</div>';
      }

      function renderEvents() {
        if (selectedDateKey) {
          renderSelectedDateEvents();
        } else {
          renderGroupedEvents();
        }
      }

      async function loadEvents() {
        eventsList.innerHTML = '<div class="calendar-event-empty">Chargement des événements…</div>';

        try {
          const res = await fetch('/api/calendar');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          loadedEvents = Array.isArray(data.events) ? data.events.slice(0, 20) : [];
          renderCalendar();
          renderEvents();
        } catch (error) {
          console.error('Calendar API:', error);
          eventsList.innerHTML = '<div class="calendar-event-empty">Calendrier indisponible.</div>';
        }
      }

      prev.addEventListener('click', (event) => {
        event.stopPropagation();
        current.setMonth(current.getMonth() - 1);
        renderCalendar();
      });

      next.addEventListener('click', (event) => {
        event.stopPropagation();
        current.setMonth(current.getMonth() + 1);
        renderCalendar();
      });

      resetSelectionBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        selectedDateKey = null;
        updateSelectionUi();
        renderEvents();
      });

      renderCalendar();
      loadEvents();
    })();
