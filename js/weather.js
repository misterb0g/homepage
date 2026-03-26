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
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`);
            if (!weatherRes.ok) throw new Error('Erreur Météo');
            
            const data = await weatherRes.json();
            let t = data?.current?.temperature_2m, wcode = data?.current?.weather_code;
            
            weatherEl.innerHTML = `<div class="row"><div id="weather-location" class="inline">${name}</div><div class="inline">•</div><div class="inline">${weatherCodeToFr(wcode)}</div><div class="inline">•</div><div class="inline">${Math.round(t)} °C</div></div>`;
        } catch (err) { console.error("Météo:", err); weatherEl.innerHTML = `<div class="inline">${err.message}</div>`; }
    }
    function weatherCodeToFr(code) { const map={0:"Ciel dégagé",1:"Plutôt dégagé",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine",61:"Pluie",63:"Pluie forte",71:"Neige",73:"Neige forte",80:"Averses",81:"Averses fortes",95:"Orages"}; return map[code] ?? "Météo"; }


// --- Météo détaillée (5 jours) ---
    (function () {
      const weatherCard = $("#weather"), details = $("#weather-details"); let loaded = false; 
      const WEATHER_CACHE_KEY = 'weather5d_cache_v1', WEATHER_TTL_MS = 3600000;

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
        details.toggleAttribute("hidden"); weatherCard.setAttribute("aria-expanded", String(!details.hasAttribute("hidden"))); 
      }
      weatherCard.addEventListener("click", toggleDetails);
      weatherCard.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDetails(); } });
    })();
