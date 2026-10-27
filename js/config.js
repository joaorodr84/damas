// Settings and rule options. Rules live here so the Portuguese rule set
// can be plugged in later without touching the UI.
const DEFAULT_SETTINGS = {
  theme: 'walnut',
  size: 8,
  first: 'white',
  coords: true,
  flip: false,
  hints: true,
  anim: true,
};

const Settings = {
  key: 'damas.settings',
  load() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(this.key) || '{}') };
    } catch { return { ...DEFAULT_SETTINGS }; }
  },
  save(s) {
    try { localStorage.setItem(this.key, JSON.stringify(s)); } catch {}
  },
};
