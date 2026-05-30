// Configuration complémentaire de la page de démarrage.
// Objectif : centraliser les profils, commandes et alias sans toucher au coeur de la page.
window.STARTPAGE_CONFIG = {
  version: '2026-05-30',

  profiles: {
    full: {
      label: 'Complet',
      description: 'Tous les modules et tous les favoris.',
      visibleCategories: null,
      hiddenWidgets: []
    },
    work: {
      label: 'Travail',
      description: 'Vue centrée sur les outils utiles en journée.',
      visibleCategories: [
        'Ressources Humaines',
        'Administration',
        'Banques & Finance',
        'Répertoire Pro',
        'Google',
        'Web-admin',
        'IA +',
        'Admin Page'
      ],
      hiddenWidgets: ['news', 'chat']
    },
    personal: {
      label: 'Perso',
      description: 'Vue plus légère pour consultation personnelle.',
      visibleCategories: ['Google', 'Divertissement', 'News', 'Sport', 'IA +'],
      hiddenWidgets: []
    }
  },

  commandAliases: {
    travail: { type: 'profile', value: 'work', label: 'Activer le profil Travail' },
    boulot: { type: 'profile', value: 'work', label: 'Activer le profil Travail' },
    pro: { type: 'profile', value: 'work', label: 'Activer le profil Travail' },
    complet: { type: 'profile', value: 'full', label: 'Activer le profil Complet' },
    full: { type: 'profile', value: 'full', label: 'Activer le profil Complet' },
    perso: { type: 'profile', value: 'personal', label: 'Activer le profil Perso' },
    focus: { type: 'toggleFocus', label: 'Basculer le mode Focus' },
    dashboard: { type: 'density', value: 'dashboard', label: 'Passer en densité Dashboard' },
    compact: { type: 'density', value: 'compact', label: 'Passer en densité Compacte' },
    normal: { type: 'density', value: 'cozy', label: 'Passer en densité Normale' },
    news: { type: 'toggleWidget', widget: 'news', label: 'Afficher / masquer les actualités' },
    actu: { type: 'toggleWidget', widget: 'news', label: 'Afficher / masquer les actualités' },
    chat: { type: 'toggleWidget', widget: 'chat', label: 'Afficher / masquer le chat' },
    calendrier: { type: 'toggleWidget', widget: 'calendar', label: 'Afficher / masquer le calendrier' },
    agenda: { type: 'bookmark', query: 'Agenda', label: 'Ouvrir Google Agenda' }
  },

  bookmarkAliases: {
    rh: 'DinClock',
    pointage: 'DinClock',
    payroll: 'Partena',
    banque: 'ING',
    compta: 'Winbooks',
    dolibarr: 'Dolibarr',
    mail: 'Mail',
    gmail: 'Mail',
    drive: 'Drive',
    maps: 'Maps',
    silex: 'Silex',
    github: 'Github',
    vercel: 'Vercel',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    strava: 'Strava',
    garmin: 'Garmin'
  }
};
