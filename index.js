require('dotenv').config();
const { Telegraf } = require('telegraf');
const OgsClient = require('./ogs-client');
const Storage = require('./storage');
const config = require('./config.example.json');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) {
  console.error('Установите TELEGRAM_TOKEN в .env или окружении.');
  process.exit(1);
}

const OWNER = config.ownerTelegramId; // ваш telegram ID
const storage = new Storage(process.env.STORAGE_PATH || null); // null -> только в памяти
const ogs = new OgsClient();

const bot = new Telegraf(BOT_TOKEN);

// helpers
function isBetweenTrackedPlayers(game, trackedSet) {
  // структура игры зависит от API; тут примерная проверка
  try {
    const p1 = game.players?.white?.id;
    const p2 = game.players?.black?.id;
    if (!p1 || !p2) return false;
    return trackedSet.has(p1) && trackedSet.has(p2);
  } catch {
    return false;
  }
}

// восстановление состояния: получить все активные игры для каждого отслеживаемого
async function restoreState() {
  const tracked = storage.getPlayers();
  if (!tracked.length) {
    console.log('Tracked list empty at startup.');
    return;
  }
  const trackedSet = new Set(tracked.map(Number));
  const found = new Set();
  for (const pid of tracked) {
    const games = await ogs.fetchActiveGamesForPlayer(pid);
    for (const g of games) {
      if (isBetweenTrackedPlayers(g, trackedSet)) {
        found.add(g.id);
      }
    }
  }
  for (const gid of found) storage.addGame(gid);
  console.log('restoreState done, games:', Array.from(found));
}

// реакция на сообщение RT от OGS
async function handleRealtimeMessage(msg) {
  // msg формат зависит от OGS RT — на форуме и в доках пишут, что сообщения бывают разными.
  // Простейшая идея: при получении события о новой/закрытой игре — проверяем участников.
  try {
    if (!msg || typeof msg !== 'object') return;
    // возможный формат: {type:'gameStarted', game: {...}} — зависит от RT
    const type = msg.type || msg.name || msg.action;
    if (!type) return;

    const trackedSet = new Set(storage.getPlayers().map(Number));

    if (type === 'game_started' || type === 'gameStarted') {
      const game = msg.game || msg;
      if (isBetweenTrackedPlayers(game, trackedSet) && !storage.hasGame(game.id)) {
        storage.addGame(game.id);
        const text = `Игра началась между ${game.players.white?.username} и ${game.players.black?.username}\nID: ${game.id}`;
        await bot.telegram.sendMessage(OWNER, text);
      }
    }

    if (type === 'game_ended' || type === 'gameEnded' || type === 'game_over') {
      const game = msg.game || msg;
      if (storage.hasGame(game.id)) {
        storage.removeGame(game.id);
        const text = `Игра закончена: ${game.id} — ${game.players.white?.username} vs ${game.players.black?.username}`;
        await bot.telegram.sendMessage(OWNER, text);
      }
    }
  } catch (e) {
    console.warn('handleRealtimeMessage error', e.message);
  }
}

// команды бота
bot.start((ctx) => ctx.reply('OGS watcher бот запущен.'));
bot.command('adduser', (ctx) => {
  if (!config.allowAddUsers) return ctx.reply('Добавление пользователей отключено.');
  const args = ctx.message.text.split(' ').slice(1);
  if (!args[0]) return ctx.reply('Использование: /adduser <ogs_id>');
  const id = Number(args[0]);
  storage.addPlayer(id);
  ctx.reply(`Добавлен игрок ${id}`);
});
bot.command('listusers', (ctx) => {
  ctx.reply(`Отслеживаемые OGS ID:\n${storage.getPlayers().join('\n') || '(пусто)'}`);
});

// main
(async () => {
  // если хотите — заранее заполните storage.trackedPlayers:
  // storage.addPlayer(12345); ...
  // или загружайте из config.example.json:
  (config.trackedPlayers || []).forEach(id => storage.addPlayer(id));

  // восстановление текущего состояния через REST
  await restoreState();

  // подключение к RT API
  ogs.connectRealtime(handleRealtimeMessage);

  // запускаем телеграм бота
  bot.launch();
  console.log('Bot started');
})();

// graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
