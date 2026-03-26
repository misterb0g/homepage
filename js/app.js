// --- Init ---
    window.addEventListener("load", () => {
      updateGreeting(); $("#clock").textContent = getTime();
      setInterval(() => { $("#clock").textContent = getTime(); if (new Date().getSeconds() === 0) updateGreeting(); }, 1000);
      setupBookmarks(); 
      getWeather();
      const showNews = localStorage.getItem('showNews') !== 'false';
      if (showNews) loadNews();
    });
