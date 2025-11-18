// Простое хранилище: память + опционально dump в файл (если хочется)
const fs = require('fs');

class Storage {
  constructor(path = null) {
    this.path = path;
    this.trackedPlayers = new Set();
    this.knownGames = new Set(); // id игр, которые считаем активными
    if (this.path && fs.existsSync(this.path)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.path));
        this.trackedPlayers = new Set(raw.trackedPlayers || []);
        this.knownGames = new Set(raw.knownGames || []);
      } catch (e) {
        console.warn('Не удалось загрузить storage:', e.message);
      }
    }
  }

  addPlayer(id) { this.trackedPlayers.add(Number(id)); this._save(); }
  removePlayer(id) { this.trackedPlayers.delete(Number(id)); this._save(); }
  getPlayers() { return Array.from(this.trackedPlayers); }

  addGame(gameId) { this.knownGames.add(gameId); this._save(); }
  removeGame(gameId) { this.knownGames.delete(gameId); this._save(); }
  hasGame(gameId) { return this.knownGames.has(gameId); }
  getGames() { return Array.from(this.knownGames); }

  _save() {
    if (!this.path) return;
    try {
      fs.writeFileSync(this.path, JSON.stringify({
        trackedPlayers: Array.from(this.trackedPlayers),
        knownGames: Array.from(this.knownGames)
      }, null, 2));
    } catch (e) {
      console.warn('storage save failed:', e.message);
    }
  }
}

module.exports = Storage;
