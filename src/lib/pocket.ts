import { getJstDayOfMonth } from "@/lib/date-jst";

// 袋（カテゴリ）ごとの今月の残額と「1日/1回あたり使える額」を計算します。
// Web画面と LINE の返信で同じ計算になるよう、ここに集めています。
export type PocketInput = {
  isFixed: boolean;
  countType: string;
  countValue: number;
  mergeSameDay: boolean;
};

export type PocketSummary = {
  budget: number; // 今月の予算
  expense: number; // 今月使った額
  remainingBudget: number; // 残額（マイナスなら予算オーバー）
  isCountMode: boolean; // true: 回数割 / false: 日数割
  usedCount: number; // 回数割で使った回数（同日まとめONなら使った日数）
  countTarget: number; // 回数割の月の目標回数
  remainingUnits: number; // 残り日数 または 残り回数（最小1）
  availablePerUnit: number; // 1日/1回あたり使える額（固定費・残額なしは0）
};

export function calcPocket(
  category: PocketInput,
  budget: number,
  transactions: { amount: number; date: Date | string }[],
  remainingDays: number,
): PocketSummary {
  const expense = transactions.reduce((sum, t) => sum + t.amount, 0);
  const remainingBudget = budget - expense;

  // DAILY 以外が指定されていれば回数割モードとして判定
  const isCountMode = category.countType !== "DAILY" && category.countType !== "DAY";
  const countTarget = category.countValue > 0 ? category.countValue : 1;

  // 同日まとめ設定がONなら利用した「日」の数をカウント、OFFなら単純な決済件数
  const usedCount = category.mergeSameDay
    ? new Set(transactions.map((t) => getJstDayOfMonth(new Date(t.date)))).size
    : transactions.length;

  // 残りの目標回数（最小1回）
  const remainingCount = Math.max(1, countTarget - usedCount);
  const remainingUnits = isCountMode ? remainingCount : remainingDays;

  const availablePerUnit =
    !category.isFixed && remainingBudget > 0
      ? Math.floor(remainingBudget / remainingUnits)
      : 0;

  return {
    budget,
    expense,
    remainingBudget,
    isCountMode,
    usedCount,
    countTarget,
    remainingUnits,
    availablePerUnit,
  };
}
