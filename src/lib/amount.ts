// DB の Int 列（PostgreSQL integer）に入る上限
export const MAX_AMOUNT = 2_147_483_647;

// 円の金額として妥当か（整数・上限以内・正の数、allowZero なら 0 も可）
export function isValidAmount(value: number, { allowZero = false } = {}): boolean {
  return (
    Number.isSafeInteger(value) &&
    value <= MAX_AMOUNT &&
    (allowZero ? value >= 0 : value > 0)
  );
}
