// --- Météo ---
async function getWeather() {
    const locationName = localStorage.getItem('weatherLocation') || 'Brussels';
    const weatherEl = $('#weather');
    weatherEl.innerHTML = `<div class="skeleton skeleton-text"></div>`;
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`);
        if (!geoRes.ok) throw new Error('Erreur Geocoding');
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) throw new Error(`Ville '${locationName}' non trouvée`);
        
        const { latitude, longitude, name } = geoData.results[0];
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto&forecast_days=1`);
        if (!weatherRes.ok) throw new Error('Erreur Météo');
        
        const data = await weatherRes.json();
        const t = data?.current?.temperature_2m;
        const wcode = data?.current?.weather_code;
        const isDay = data?.current?.is_day !== 0;

        applyWeatherContext(weatherEl, wcode, isDay);
        weatherEl.innerHTML = `<div class="row"><div id="weather-location" class="inline">${name}</div><div class="inline">•</div><div class="inline">${weatherCodeToFr(wcode)}</div><div class="inline">•</div><div class="inline">${Math.round(t)} °C</div></div>`;
    } catch (err) {
        console.error("Météo:", err);
        clearWeatherContext(weatherEl);
        weatherEl.innerHTML = `<div class="inline">${err.message}</div>`;
    }
}

function weatherContextFromCode(code) {
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([45, 48].includes(code)) return 'fog';
    if ([1, 2, 3].includes(code)) return 'cloudy';
    return 'clear';
}

function clearWeatherContext(weatherEl) {
    if (!weatherEl) return;
    weatherEl.classList.remove(
        'is-weather-clear',
        'is-weather-cloudy',
        'is-weather-rain',
        'is-weather-snow',
        'is-weather-fog',
        'is-weather-storm',
        'is-weather-day',
        'is-weather-night'
    );
}

function applyWeatherContext(weatherEl, code, isDay) {
    if (!weatherEl) return;
    clearWeatherContext(weatherEl);
    const context = weatherContextFromCode(code);
    weatherEl.classList.add(`is-weather-${context}`);
    weatherEl.classList.add(isDay ? 'is-weather-day' : 'is-weather-night');
    weatherEl.dataset.weatherContext = context;
}

function weatherCodeToFr(code) {
    const map={0:"Ciel dégagé",1:"Plutôt dégagé",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine",53:"Bruine",55:"Bruine forte",61:"Pluie",63:"Pluie forte",65:"Pluie intense",71:"Neige",73:"Neige forte",75:"Neige intense",80:"Averses",81:"Averses fortes",82:"Averses violentes",95:"Orages",96:"Orages",99:"Orages forts"};
    return map[code] ?? "Météo";
}

// --- Météo détaillée (5 jours) ---
(function () {
  const weatherCard = $("#weather"), details = $("#weather-details"); let loaded = false; 
  const WEATHER_CACHE_KEY = 'weather5d_cache_v1', WEATHER_TTL_MS = 3600000;

  if (!weatherCard || !details) return;

  function syncDetailsVisibility() {
    const hidden = details.hasAttribute('hidden');
    details.style.display = hidden ? 'none' : '';
    weatherCard.setAttribute('aria-expanded', String(!hidden));
  }

  async function getWeather5dCached() {
    try { const raw = localStorage.getItem(WEATHER_CACHE_KEY); if (raw) { const { ts, data, location } = JSON.parse(raw); const currentLocation = localStorage.getItem('weatherLocation') || 'Brussels'; if (data && (Date.now() - ts < WEATHER_TTL_MS) && location === currentLocation) return data; } } catch {}
    
    const locationName = localStorage.getItem('weatherLocation') || 'Brussels';
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`);
    const geoData = await geoRes.json();
    const { latitude, longitude } = geoData.results[0];
    
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
    const data = await weatherRes.json();
    try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data, location: locationName })); } catch {}
    return data;
  }

  function renderWeather5d(data) { 
    const days = data.daily.time.map((d, i) => ({ date: d, code: data.daily.weather_code[i], tmax: Math.round(data.daily.temperature_2m_max[i]), tmin: Math.round(data.daily.temperature_2m_min[i]) })); 
    const df = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'short' }); 
    details.innerHTML = `<div class='weather5d'>${days.map(day => `<div class="weather-day"><div class="wd-date">${df.format(new Date(day.date))}</div><div class="wd-desc">${weatherCodeToFr(day.code)}</div><div class="wd-temps"><span class="max">${day.tmax}°</span> / <span class="min">${day.tmin}°</span></div></div>`).join("")}</div>`; 
  }

  async function toggleDetails() { 
    const isHidden = details.hasAttribute("hidden"); 
    if (isHidden && !loaded) { 
        try { details.innerHTML = "Chargement…"; const data = await getWeather5dCached(); renderWeather5d(data); loaded = true; } 
        catch (e) { details.innerHTML = `<div class='wd-error'>Prévisions indisponibles</div>`; } 
    }
    details.toggleAttribute("hidden");
    syncDetailsVisibility();
  }

  syncDetailsVisibility();
  weatherCard.addEventListener("click", toggleDetails);
  weatherCard.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDetails(); } });
})();

// --- StartDesk module bridge ---
if (window.StartDesk && typeof window.StartDesk.register === 'function') {
  window.StartDesk.register('weather', {
    init: getWeather,
    refresh: getWeather,
    describeCode: weatherCodeToFr,
    describeContext: weatherContextFromCode
  });
}

// --- Start Desk 5 : feuille de style du panneau Paramètres ---
(function loadSettingsPolishStylesheet() {
  if (document.querySelector('link[data-startdesk-settings-polish]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/settings-polish.css';
  link.dataset.startdeskSettingsPolish = '1';
  document.head.appendChild(link);
})();