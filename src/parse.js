import { getOpenAI } from './openai-client.js';

const MODEL = process.env.PARSE_MODEL || 'gpt-4o-mini';

// 取得今天日期(本地時區)YYYY-MM-DD
function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 把一句口語記帳內容,用 GPT 解析成結構化欄位
 * @param {string} text 例如「今天午餐買便當 120 元」
 * @returns {Promise<{date:string,item:string,amount:number}>}
 */
export async function parseExpense(text) {
  const day = today();

  const res = await getOpenAI().chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          `你是記帳助理。把使用者的口語記帳內容解析成 JSON,只能回 JSON,不要任何多餘文字。\n` +
          `欄位定義:\n` +
          `- date: 日期,格式 YYYY-MM-DD。若使用者沒明確說日期,就用今天 ${day}。「昨天」「前天」「上週X」等請依今天推算。\n` +
          `- item: 消費項目的簡短名稱(字串)。\n` +
          `- amount: 金額,純數字(新台幣),不要含貨幣符號。無法判斷時填 0。`,
      },
      { role: 'user', content: text },
    ],
  });

  let data;
  try {
    data = JSON.parse(res.choices[0].message.content);
  } catch {
    data = {};
  }

  // 正規化 / 補預設值,避免欄位缺漏
  return {
    date: data.date || day,
    item: data.item || text,
    amount: Number(data.amount) || 0,
  };
}
