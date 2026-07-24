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

  function getNextEvent() {
    const now = Date.now();
    return loadedEvents
      .filter((event) => {
        const start = new Date(event.start).getTime();
        const end = event.end ? new Date(event.end).getTime() : start;
        return Number.isFinite(start) && Math.max(start, end) >= now;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))[0] || null;
  }

  function formatDurationMinutes(minutes) {
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
    const hours = Math.round(minutes / 60);
    return `${hours} h`;
  }

  function getRelativeEventLabel(event) {
    if (!event || !event.start) return null;

    const now = new Date();
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : null;
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const eventDay = startOfDay(start);

    if (event.allDay) {
      if (eventDay.getTime() === today.getTime()) return { text: 'Aujourd’hui · toute la journée', isNow: true };
      if (eventDay.getTime() === tomorrow.getTime()) return { text: 'Demain · toute la journée', isNow: false };
      return null;
    }

    if (end && now >= start && now < end) {
      const remaining = Math.max(1, (end - now) / 60000);
      return { text: `En cours · encore ${formatDurationMinutes(remaining)}`, isNow: true };
    }

    const minutesUntil = (start - now) / 60000;
    if (minutesUntil < 0) return null;

    if (minutesUntil <= 90) {
      return { text: `Dans ${formatDurationMinutes(minutesUntil)}`, isNow: false };
    }

    if (eventDay.getTime() === today.getTime()) {
      const hour = start.getHours();
      if (now.getHours() < 12 && hour >= 12 && hour < 18) return { text: 'Cet après-midi', isNow: false };
      if (now.getHours() < 18 && hour >= 18) return { text: 'Ce soir', isNow: false };
      return { text: `Aujourd’hui à ${timeFmt.format(start)}`, isNow: false };
    }

    if (eventDay.getTime() === tomorrow.getTime()) {
      return { text: `Demain à ${timeFmt.format(start)}`, isNow: false };
    }

    const daysUntil = Math.round((eventDay - today) / 86400000);
    if (daysUntil > 1 && daysUntil <= 6) {
      return { text: `Dans ${daysUntil} jours`, isNow: false };
    }

    return null;
  }

  function isSameEvent(a, b) {
    if (!a || !b) return false;
    return String(a.start) === String(b.start) && String(a.title || '') === String(b.title || '');
  }

  function formatEvent(event, nextEvent = null) {
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : null;
    const allDay = !!event.allDay;
    const isNext = isSameEvent(event, nextEvent);
    const relative = isNext ? getRelativeEventLabel(event) : null;

    const dateLabel = dateFmt.format(start);
    const timeLabel = allDay
      ? 'Toute la journée'
      : `${timeFmt.format(start)}${end ? ` – ${timeFmt.format(end)}` : ''}`;

    const classes = `calendar-event-item${event.url ? ' is-link' : ''}${isNext ? ' is-next-event' : ''}`;
    const wrapperTag = event.url ? 'a' : 'article';
    const wrapperAttrs = event.url
      ? `href="${event.url}" target="_blank" rel="noopener noreferrer" class="${classes}"`
      : `class="${classes}"`;

    return `
      <${wrapperTag} ${wrapperAttrs}>
        <div class="calendar-event-icon" aria-hidden="true">${getEventIcon(event)}</div>
        <div class="calendar-event-main">
          <div class="calendar-event-name">${event.title || 'Événement'}</div>
          <div class="calendar-event-meta">${dateLabel} · ${timeLabel}</div>
          ${relative ? `<div class="calendar-event-relative${relative.isNow ? ' is-now' : ''}">${relative.text}</div>` : ''}
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

    const nextEvent = getNextEvent();
    eventsList.innerHTML = `
      <section class="calendar-event-group">
        <div class="calendar-event-group-title">Événements du jour</div>
        <div class="calendar-event-group-list">
          ${selectedEvents.map(event => formatEvent(event, nextEvent)).join('')}
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
    const nextEvent = getNextEvent();

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
            ${buckets.today.map(event => formatEvent(event, nextEvent)).join('')}
          </div>
        </section>
      `);
    }

    if (buckets.tomorrow.length) {
      sections.push(`
        <section class="calendar-event-group">
          <div class="calendar-event-group-title">Demain</div>
          <div class="calendar-event-group-list">
            ${buckets.tomorrow.map(event => formatEvent(event, nextEvent)).join('')}
          </div>
        </section>
      `);
    }

    if (buckets.later.length) {
      sections.push(`
        <section class="calendar-event-group">
          <div class="calendar-event-group-title">À venir</div>
          <div class="calendar-event-group-list">
            ${buckets.later.slice(0, 4).map(event => formatEvent(event, nextEvent)).join('')}
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

  // Maintient les libellés « dans X min » à jour sans nouvel appel réseau.
  window.setInterval(() => {
    if (loadedEvents.length) renderEvents();
  }, 60000);
})();
