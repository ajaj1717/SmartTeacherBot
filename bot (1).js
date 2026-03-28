const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// تخزين بيانات المستخدمين
const users = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users[chatId] = { specialty: null, history: [] };

  bot.sendMessage(chatId, `👋 أهلاً بك في *المعلم الذكي*!

أنا معلمك الشخصي المتخصص في أي مجال تختاره.

أرسل لي المجال الذي تريد التعلم فيه، مثلاً:
• رياضيات
• برمجة
• إنجليزي
• تاريخ
• أي مجال آخر!`, { parse_mode: 'Markdown' });
});

bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  users[chatId] = { specialty: null, history: [] };
  bot.sendMessage(chatId, '🔄 تم إعادة الضبط! أرسل لي المجال الذي تريد التعلم فيه.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  if (!users[chatId]) {
    users[chatId] = { specialty: null, history: [] };
  }

  // إذا ما عنده تخصص بعد
  if (!users[chatId].specialty) {
    users[chatId].specialty = text;
    users[chatId].history = [];
    bot.sendMessage(chatId, `✅ ممتاز! أنا الحين متخصص في *${text}* وجاهز أساعدك.

اسألني أي سؤال في هذا المجال! 🎓`, { parse_mode: 'Markdown' });
    return;
  }

  // إضافة رسالة المستخدم للتاريخ
  users[chatId].history.push({
    role: 'user',
    content: text
  });

  // إرسال "يكتب..."
  bot.sendChatAction(chatId, 'typing');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `أنت معلم شخصي متخصص في مجال: ${users[chatId].specialty}. 
أجب على أسئلة المستخدم بشكل واضح ومفيد ومفصّل.
استخدم اللغة العربية دائماً.
إذا كان السؤال خارج تخصصك، قل للمستخدم أن يكتب /reset لتغيير المجال.`,
        messages: users[chatId].history.slice(-10)
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'حدث خطأ، حاول مرة ثانية.';

    // إضافة رد البوت للتاريخ
    users[chatId].history.push({
      role: 'assistant',
      content: reply
    });

    bot.sendMessage(chatId, reply);

  } catch (e) {
    bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة ثانية.');
  }
});

console.log('✅ البوت يشتغل...');
