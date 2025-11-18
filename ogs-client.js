const io = require('socket.io-client');
const axios = require('axios');

const OGS_REST = 'https://online-go.com/api/v1';

class OgsClient {
  constructor() {
    this.socket = null;
  }

  // Подключение к RT API (socket.io)
  connectRealtime(onMessage) {
    // Документация: RT API использует socket.io на ggs.online-go.com
    this.socket = io('https://ggs.online-go.com', {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      // можно добавить auth если потребуется
    });

    this.socket.on('connect', () => {
      console.log('OGS realtime connected, id=', this.socket.id);
    });

    this.socket.on('message', (msg) => {
      // некоторые сервера шлют разные форматы; отлавливаем содержимое
      if (onMessage) onMessage(msg);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('OGS disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('OGS connect error', err.message || err);
    });
  }

  // Получить активные игры игрока через REST
  async fetchActiveGamesForPlayer(playerId) {
    try {
      const url = `${OGS_REST}/players/${playerId}/games/active/`;
      const r = await axios.get(url, { timeout: 10000 });
      return r.data.results || [];
    } catch (e) {
      console.warn('fetchActiveGames error for', playerId, e.message);
      return [];
    }
  }

  // Получить детали игры по id
  async getGame(gameId) {
    try {
      const r = await axios.get(`${OGS_REST}/games/${gameId}/`);
      return r.data;
    } catch (e) {
      return null;
    }
  }
}

module.exports = OgsClient;
