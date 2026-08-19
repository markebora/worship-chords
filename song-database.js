/* The Disciples — song database adapter
 *
 * Keeps the app independent from the storage provider. The same search API can
 * use the bundled index now and a private Google Drive catalog later.
 */
(function () {
  'use strict';

  const DEFAULT_INDEX_URL = './song-database.json';
  let indexCache = null;
  let indexPromise = null;
  let config = {
    indexUrl: DEFAULT_INDEX_URL,
    provider: 'local'
  };

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function configure(next) {
    config = Object.assign({}, config, next || {});
    indexCache = null;
    indexPromise = null;
  }

  async function loadIndex(force) {
    if (!force && indexCache) return indexCache;
    if (!force && indexPromise) return indexPromise;

    indexPromise = fetch(config.indexUrl, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Song database could not be loaded.');
        return response.json();
      })
      .then(function (data) {
        indexCache = data && Array.isArray(data.songs) ? data : { version: 1, songs: [] };
        return indexCache;
      })
      .finally(function () {
        indexPromise = null;
      });

    return indexPromise;
  }

  async function search(query, limit) {
    const db = await loadIndex();
    const q = normalize(query);
    const max = Number(limit) > 0 ? Number(limit) : 20;
    if (!q) return db.songs.slice(0, max);

    return db.songs
      .map(function (song) {
        const title = normalize(song.title);
        const artist = normalize(song.artist);
        let score = 0;
        if (title === q) score += 100;
        if (title.indexOf(q) === 0) score += 60;
        if (title.indexOf(q) >= 0) score += 40;
        if (artist.indexOf(q) >= 0) score += 20;
        return { song: song, score: score };
      })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.song.title.localeCompare(b.song.title); })
      .slice(0, max)
      .map(function (item) { return item.song; });
  }

  async function getSong(id) {
    const db = await loadIndex();
    const entry = db.songs.find(function (song) { return String(song.id) === String(id); });
    if (!entry) return null;
    if (entry.data) return entry.data;
    if (!entry.file) return entry;

    const response = await fetch(entry.file, { cache: 'no-store' });
    if (!response.ok) throw new Error('Song file could not be loaded.');
    return response.json();
  }

  window.WorshipSongDatabase = {
    configure: configure,
    loadIndex: loadIndex,
    search: search,
    getSong: getSong,
    getConfig: function () { return Object.assign({}, config); }
  };
})();
