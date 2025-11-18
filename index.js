require("dotenv").config();
const axios = require("axios");
const { Telegraf } = require("telegraf");
const config = require("./config.json");

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const OWNER = config.ownerTelegramId;

if (!BOT_TOKEN) {
  console.error("Нет TELEGRAM_TOKEN в .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===========================
// УТИЛИТЫ
// ===========================

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();

  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

// ===========================
// ОПРОС API OGS
// ===========================

async function fetchGames(playerId) {
  const url = `https://online-go.com/api/v1/players/${playerId}/games`;

  try {
    const r = await axios.get(url);
    return r.data.results || [];
  } catch (e) {
    const status = e.response?.status;

    if (status === 500 || status === 503) {
      console.log(`OGS отдал ${status} для ${playerId}, пропускаю...`);
    } else {
      console.log(`Ошибка OGS для ${playerId}:`, status);
    }

    return [];
  }
}

// ===========================
// ЛОГИКА ПРОВЕРКИ НОВЫХ ИГР
// ===========================

const announcedGames = new Set(); // чтобы не спамить

async function checkAllPlayers() {
  const players = config.trackedPlayers;

  for (const pid of players) {
    const games = await fetchGames(pid);
    await delay(800);

    for (const g of games) {
      // фильтрация по дате
      if (!isToday(g.ended)) continue;

      if (announcedGames.has(g.id)) continue;
      announcedGames.add(g.id);

      const msg =
        `Найдена новая игра сегодня!\n` +
        `Игрок: ${pid}\n` +
        `Против: ${g.opponent?.username || "???"}\n` +
        `Результат: ${g.outcome}\n\n` +
        `Ссылка: https://online-go.com/game/${g.id}`;

      await bot.telegram.sendMessage(OWNER, msg);
    }
  }
}

// ===========================
// СТАРТ БОТА
// ===========================

bot.start((ctx) => ctx.reply("Бот работает."));

(async () => {
  console.log("Запускаем бота...");

  await bot.launch();
  console.log("Bot started");

  // приветствие
  try {
    await bot.telegram.sendMessage(OWNER, "Бот запущен! 🚀");
  } catch {}

  // запуск периодического опроса
  setInterval(checkAllPlayers, 30 * 60 * 1000); // каждые 30 мин
  checkAllPlayers(); // сразу первый прогон
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

