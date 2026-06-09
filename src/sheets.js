import { google } from 'googleapis';

const SHEET_NAME = process.env.SHEET_NAME || '記帳';
export const HEADERS = ['日期', '項目', '金額'];

let sheetsClient;

// 建立(並快取)Google Sheets API client
function getClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function spreadsheetId() {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('缺少 SPREADSHEET_ID,請在 .env 設定試算表 ID');
  return id;
}

/**
 * 確保第一列有表頭;若工作表是空的就寫入表頭
 */
export async function ensureHeaders() {
  const sheets = getClient();
  const id = spreadsheetId();

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A1:C1`,
  });

  if (!data.values || data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADERS] },
    });
    return true; // 有寫入表頭
  }
  return false;
}

/**
 * 新增一筆記帳到試算表最後一列
 * @param {{date:string,item:string,amount:number}} row
 */
export async function appendRow(row) {
  const sheets = getClient();
  const id = spreadsheetId();

  const values = [[row.date, row.item, row.amount]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A:C`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}
