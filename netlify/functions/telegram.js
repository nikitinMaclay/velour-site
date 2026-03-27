// =====================================================
// VELOUR — Telegram Notification Function
// =====================================================
// Отправляет заказы и заявки с формы обратной связи
// прямо в Telegram-бот (тебе в ЛС).
//
// Переменные окружения (настроить в Netlify):
//   TELEGRAM_BOT_TOKEN  — токен бота от @BotFather
//   TELEGRAM_CHAT_ID    — твой chat_id (получить через @userinfobot)
// =====================================================

exports.handler = async (event) => {
  // CORS — разрешаем только POST
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Server misconfigured' }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  // Собираем текст сообщения в зависимости от типа
  let text;

  if (data.type === 'order') {
    // ====== ЗАКАЗ ======
    const itemsList = (data.items || [])
      .map((i) => `   • ${i.name} × ${i.qty} — ₸ ${(i.price * i.qty).toLocaleString('ru-RU')}`)
      .join('\n');

    text = [
      '🛍 *НОВЫЙ ЗАКАЗ*',
      '',
      `👤 *Имя:* ${esc(data.name)}`,
      `📞 *Телефон:* ${esc(data.phone)}`,
      data.city ? `🏙 *Город:* ${esc(data.city)}` : '',
      '',
      '📦 *Товары:*',
      itemsList,
      '',
      `💰 *Итого:* ₸ ${(data.total || 0).toLocaleString('ru-RU')}`,
      data.comment ? `\n💬 *Комментарий:* ${esc(data.comment)}` : '',
      '',
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`,
    ]
      .filter(Boolean)
      .join('\n');

  } else if (data.type === 'contact') {
    // ====== ОБРАТНАЯ СВЯЗЬ ======
    const topicMap = {
      general: 'Общий вопрос',
      consultation: 'Консультация по уходу',
      order: 'Вопрос по заказу',
      collab: 'Сотрудничество',
    };

    text = [
      '✉️ *НОВОЕ СООБЩЕНИЕ*',
      '',
      `👤 *Имя:* ${esc(data.name)}`,
      `📞 *Телефон:* ${esc(data.phone)}`,
      data.email ? `📧 *Email:* ${esc(data.email)}` : '',
      `📋 *Тема:* ${topicMap[data.topic] || data.topic}`,
      '',
      `💬 *Сообщение:*`,
      esc(data.message),
      '',
      `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`,
    ]
      .filter(Boolean)
      .join('\n');

  } else {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Unknown type' }),
    };
  }

  // Отправляем в Telegram
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: 'Markdown',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram API error:', err);
      return {
        statusCode: 502,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Telegram send failed' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

// Экранируем спецсимволы Markdown
function esc(s) {
  if (!s) return '';
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
