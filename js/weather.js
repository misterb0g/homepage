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

// Monochrome silhouettes inherit the theme colour; descriptions remain readable.
function weatherForecastIcon(code) {
    const cloud = '<path d="M8 25a6 6 0 0 1-.8-11.95A8 8 0 0 1 22.5 11a7 7 0 1 1 1.5 14Z"/>';
    const sun = '<circle cx="12" cy="12" r="5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    let shape;
    if (code === 0) shape = '<g transform="translate(4 4)">' + sun + '</g>';
    else if (code === 1 || code === 2) shape = sun + cloud;
    else if (code === 3) shape = cloud;
    else if ([45, 48].includes(code)) shape = '<path d="M7 13a5 5 0 0 1 1-9 7 7 0 0 1 13 1 5 5 0 0 1 4 8Z"/><path d="M5 18h22M8 23h16M5 28h22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    else if ([95, 96, 99].includes(code)) shape = cloud + '<path d="m17 20-6 8h5l-1 4 8-10h-6Z"/>';
    else if ([71, 73, 75, 77, 85, 86].includes(code)) shape = cloud + '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 27v5m-2.2-3.8 4.4 2.6m-4.4 0 4.4-2.6M23 27v5m-2.2-3.8 4.4 2.6m-4.4 0 4.4-2.6"/></g>';
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) shape = cloud + '<path d="m10 28-1 3m8-3-1 3m8-3-1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    else shape = '<text x="16" y="24" text-anchor="middle" font-size="23" fill="currentColor">?</text>';
    return '<svg class="wd-icon" viewBox="0 0 32 34" fill="currentColor" aria-hidden="true" focusable="false">' + shape + '</svg>';
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

  function validForecast(data) {
    const daily = data?.daily;
    return Array.isArray(daily?.time) &&
      Array.isArray(daily?.weather_code) &&
      Array.isArray(daily?.temperature_2m_max) &&
      Array.isArray(daily?.temperature_2m_min) &&
      daily.time.length >= 5 &&
      ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].every(key =>
        daily[key].length >= daily.time.length
      ) &&
      daily.time.every((date, i) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(daily.temperature_2m_max[i]) &&
        Number.isFinite(daily.temperature_2m_min[i])
      );
  }

  async function fetchJson(url, label) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${label} : HTTP ${response.status}`);
    const data = await response.json();
    if (data?.error) throw new Error(`${label} : ${data.reason || 'réponse invalide'}`);
    return data;
  }

  async function getWeather5dCached() {
    const locationName = localStorage.getItem('weatherLocation') || 'Brussels';
    let previous;
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache?.location === locationName && validForecast(cache.data)) {
          previous = cache.data;
          if (Date.now() - cache.ts < WEATHER_TTL_MS) return cache.data;
        } else {
          localStorage.removeItem(WEATHER_CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('Cache prévisions inutilisable :', error);
    }

    try {
      const geoData = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`,
        'Géocodage'
      );
      const place = geoData?.results?.[0];
      if (!Number.isFinite(place?.latitude) || !Number.isFinite(place?.longitude)) {
        throw new Error(`Ville "${locationName}" introuvable`);
      }
      const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
        forecast_days: '5'
      });
      const data = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        'Prévisions Open-Meteo'
      );
      if (!validForecast(data)) throw new Error('Prévisions incomplètes');
      try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
          ts: Date.now(), location: locationName, data
        }));
      } catch (error) {
        console.warn('Cache prévisions non enregistré :', error);
      }
      return data;
    } catch (error) {
      if (previous) {
        console.warn('Prévisions indisponibles, affichage du dernier relevé :', error);
        return previous;
      }
      throw error;
    }
  }

  function renderWeather5d(data) {
    if (!validForecast(data)) throw new Error('Données de prévision incomplètes');
    const days = data.daily.time.slice(0, 5).map((date, i) => ({
      date,
      code: data.daily.weather_code[i],
      tmax: Math.round(data.daily.temperature_2m_max[i]),
      tmin: Math.round(data.daily.temperature_2m_min[i])
    }));
    const df = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
    details.innerHTML = `<div class="weather5d">${days.map(day => `<div class="weather-day"><div class="wd-date">${df.format(new Date(day.date + 'T12:00:00Z'))}</div>${weatherForecastIcon(day.code)}<div class="wd-desc">${weatherCodeToFr(day.code)}</div><div class="wd-temps"><span class="max">${day.tmax}°</span> / <span class="min">${day.tmin}°</span></div></div>`).join('')}</div>`;
  }

  async function toggleDetails() {
    const isHidden = details.hasAttribute('hidden');
    if (isHidden && !loaded) {
      details.textContent = 'Chargement…';
      try {
        const data = await getWeather5dCached();
        renderWeather5d(data);
        loaded = true;
      } catch (error) {
        console.error('Prévisions sur cinq jours :', error);
        details.textContent = 'Prévisions indisponibles — refermez et réessayez';
      }
    }
    details.toggleAttribute('hidden');
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

// Styles de paramètres chargés dans index.html avant le thème Neumorphism.
