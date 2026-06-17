// Configuration complémentaire de la page de démarrage.
// Start Desk v1 : profils plus lisibles, commandes rapides et alias personnels.
window.STARTPAGE_CONFIG = {
  version: '2026-06-17-start-desk-v3',

  profiles: {
    silex: {
      label: 'Silex',
      description: 'Mode quotidien : outils de direction, administration, Google, IA et gestion web.',
      visibleCategories: [
        'Google',
        'Administration',
        'Ressources Humaines',
        'Banques & Finance',
        'Web-admin',
        'IA +',
        'Admin Page'
      ],
      hiddenWidgets: ['news', 'chat'],
      showWidgets: ['calendar']
    },
    focus: {
      label: 'Focus',
      description: 'Vue courte : les outils réellement utilisés au démarrage.',
      visibleCategories: ['Google', 'Administration', 'IA +', 'Admin Page'],
      hiddenWidgets: ['news', 'chat', 'calendar']
    },
    code: {
      label: 'Code',
      description: 'GitHub, Vercel et assistants IA.',
      visibleCategories: ['Admin Page', 'IA +', 'Google'],
      hiddenWidgets: ['news', 'chat', 'calendar']
    },
    personal: {
      label: 'Perso',
      description: 'Usage personnel : infos, sport, divertissement et IA.',
      visibleCategories: ['Google', 'Divertissement', 'News', 'Sport', 'IA +'],
      hiddenWidgets: ['chat'],
      showWidgets: ['news', 'calendar']
    },
    full: {
      label: 'Complet',
      description: 'Tous les modules et tous les favoris.',
      visibleCategories: null,
      hiddenWidgets: [],
      showWidgets: ['news', 'chat', 'calendar']
    },
    // Compatibilité avec l’ancienne configuration.
    work: {
      label: 'Travail',
      description: 'Alias de Silex pour les anciennes commandes.',
      visibleCategories: [
        'Google',
        'Administration',
        'Ressources Humaines',
        'Banques & Finance',
        'Répertoire Pro',
        'Web-admin',
        'IA +',
        'Admin Page'
      ],
      hiddenWidgets: ['news', 'chat']
    }
  },

  commandAliases: {
    silex: { type: 'profile', value: 'silex', label: 'Activer le profil Silex' },
    travail: { type: 'profile', value: 'silex', label: 'Activer le profil Silex' },
    boulot: { type: 'profile', value: 'silex', label: 'Activer le profil Silex' },
    pro: { type: 'profile', value: 'silex', label: 'Activer le profil Silex' },
    focus: { type: 'profile', value: 'focus', label: 'Activer le profil Focus' },
    code: { type: 'profile', value: 'code', label: 'Activer le profil Code' },
    dev: { type: 'profile', value: 'code', label: 'Activer le profil Code' },
    perso: { type: 'profile', value: 'personal', label: 'Activer le profil Perso' },
    complet: { type: 'profile', value: 'full', label: 'Activer le profil Complet' },
    full: { type: 'profile', value: 'full', label: 'Activer le profil Complet' },
    dashboard: { type: 'density', value: 'dashboard', label: 'Passer en densité Dashboard' },
    compact: { type: 'density', value: 'compact', label: 'Passer en densité Compacte' },
    normal: { type: 'density', value: 'cozy', label: 'Passer en densité Normale' },
    news: { type: 'toggleWidget', widget: 'news', label: 'Afficher / masquer les actualités' },
    actu: { type: 'toggleWidget', widget: 'news', label: 'Afficher / masquer les actualités' },
    chat: { type: 'toggleWidget', widget: 'chat', label: 'Afficher / masquer le chat' },
    notes: { type: 'internal', value: 'notes', label: 'Ouvrir les notes rapides' },
    calendrier: { type: 'toggleWidget', widget: 'calendar', label: 'Afficher / masquer le calendrier' },
    agenda: { type: 'bookmark', query: 'Agenda', label: 'Ouvrir Google Agenda' },
    mail: { type: 'bookmark', query: 'Mail', label: 'Ouvrir Gmail' },
    drive: { type: 'bookmark', query: 'Drive', label: 'Ouvrir Drive' },
    github: { type: 'bookmark', query: 'Github', label: 'Ouvrir GitHub' },
    vercel: { type: 'bookmark', query: 'Vercel', label: 'Ouvrir Vercel' },
    dinclock: { type: 'bookmark', query: 'DinClock', label: 'Ouvrir DinClock' },
    partena: { type: 'bookmark', query: 'Partena', label: 'Ouvrir Partena' },
    dolibarr: { type: 'bookmark', query: 'Dolibarr', label: 'Ouvrir Dolibarr' }
  },

  bookmarkAliases: {
    rh: 'DinClock',
    pointage: 'DinClock',
    payroll: 'Partena',
    banque: 'ING',
    compta: 'Winbooks',
    dolibarr: 'Dolibarr',
    odoo: 'Odoo',
    cle: 'Clé',
    clé: 'Clé',
    mail: 'Mail',
    gmail: 'Mail',
    drive: 'Drive',
    agenda: 'Agenda',
    calendrier: 'Agenda',
    maps: 'Maps',
    silex: 'Silex',
    github: 'Github',
    git: 'Github',
    vercel: 'Vercel',
    chatgpt: 'ChatGPT',
    ai: 'ChatGPT',
    ia: 'ChatGPT',
    gemini: 'Gemini',
    strava: 'Strava',
    garmin: 'Garmin'
  }
};
