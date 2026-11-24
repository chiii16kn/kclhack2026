// サーバー(Vercel)は UTC で動くため、日付の区切りはすべて日本時間(JST)で計算します。
// JST はサマータイムが無いので固定オフセットで扱えます。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getJstDateParts(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

// 例: "2026-10"
export function getJstYearMonth(date: Date = new Date()): string {
  const { year, month } = getJstDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isValidYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// "2026-10" の JST 月初〜翌月初を UTC の Date で返します（Prisma の date 検索用）
export function getJstMonthRangeFromYearMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1) - JST_OFFSET_MS),
    lt: new Date(Date.UTC(year, month, 1) - JST_OFFSET_MS),
  };
}

export function getJstMonthRange(date: Date = new Date()) {
  return getJstMonthRangeFromYearMonth(getJstYearMonth(date));
}

// 今日を含めた月末までの残り日数（最小1）
export function getJstRemainingDaysInMonth(date: Date = new Date()): number {
  const { year, month, day } = getJstDateParts(date);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(1, lastDay - day + 1);
}

// JST での「何日か」（同日まとめの判定用）
export function getJstDayOfMonth(date: Date): number {
  return getJstDateParts(date).day;
}
