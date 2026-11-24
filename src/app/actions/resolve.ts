// src/app/actions/resolve.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { isValidAmount } from "@/lib/amount";
import {
  getJstMonthRangeFromYearMonth,
  getJstYearMonth,
  isValidYearMonth,
} from "@/lib/date-jst";
import { revalidatePath } from "next/cache";

// 自分のカテゴリかを確認したうえで、その月の予算に amount を加算します。
// 読み込み→書き込みの間に別リクエストが入っても加算が失われないよう increment を使います。
async function addToCategoryBudget(
  userId: string,
  categoryId: string,
  yearMonth: string,
  amount: number,
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!category) return false;

  await prisma.monthlyBudget.upsert({
    where: { categoryId_yearMonth: { categoryId, yearMonth } },
    update: { amount: { increment: amount } },
    create: { userId, categoryId, yearMonth, amount },
  });
  return true;
}

type ResolveInput = {
  categoryId?: unknown;
  id?: unknown;
  yearMonth?: unknown;
  amount?: unknown;
  remaining?: unknown;
};

// ① 赤字の袋を補填する処理
export async function resolveDeficit(
  input: FormData | ResolveInput | string,
  arg2?: number | string,
  arg3?: string | number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let categoryId = "";
  let yearMonth = "";
  let amountToCover = 0;

  // 引数の形式に応じた抽出
  if (input instanceof FormData) {
    categoryId = getFormDataString(input, "categoryId");
    yearMonth = getFormDataString(input, "yearMonth");
    amountToCover = Number(input.get("amount") || 0);
  } else if (typeof input === "object" && input !== null) {
    const inputCategoryId = input.categoryId || input.id || "";
    categoryId = typeof inputCategoryId === "string" ? inputCategoryId : "";
    yearMonth = typeof input.yearMonth === "string" ? input.yearMonth : "";
    amountToCover = Number(input.amount || Math.abs(Number(input.remaining || 0)));
  } else if (typeof input === "string") {
    categoryId = input;
  }

  // 第2引数・第3引数の型判定
  if (typeof arg2 === "number") {
    amountToCover = arg2;
  } else if (typeof arg2 === "string") {
    yearMonth = arg2;
  }

  if (typeof arg3 === "string") {
    yearMonth = arg3;
  } else if (typeof arg3 === "number") {
    amountToCover = arg3;
  }

  // 年月が空の場合は当月を自動設定
  if (!yearMonth) {
    yearMonth = getJstYearMonth();
  }
  if (!isValidYearMonth(yearMonth)) return;

  if (!categoryId || typeof categoryId !== "string") {
    return;
  }

  // 補填金額が未指定の場合は当月の赤字額を自動計算
  if (!amountToCover || amountToCover <= 0) {
    const budget = await prisma.monthlyBudget.findFirst({
      where: { userId: user.id, categoryId, yearMonth },
    });
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        categoryId,
        type: "EXPENSE",
        date: getJstMonthRangeFromYearMonth(yearMonth),
      },
    });
    // ▼ sum と t の両方に型を指定してエラーを回避 ▼
    const totalExpense = transactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
    const budgetAmount = budget?.amount ?? 0;
    if (totalExpense > budgetAmount) {
      amountToCover = totalExpense - budgetAmount;
    }
  }

  if (!isValidAmount(amountToCover)) return;

  if (!(await addToCategoryBudget(user.id, categoryId, yearMonth, amountToCover))) return;

  revalidatePath("/");
}

// ② 未配分プールから指定の袋に予算を追加する処理
export async function quickAllocate(
  input: FormData | ResolveInput | string,
  arg2?: number | string,
  arg3?: string | number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let categoryId = "";
  let yearMonth = "";
  let amountToAdd = 0;

  if (input instanceof FormData) {
    categoryId = getFormDataString(input, "categoryId");
    yearMonth = getFormDataString(input, "yearMonth");
    amountToAdd = Number(input.get("amount") || 0);
  } else if (typeof input === "object" && input !== null) {
    const inputCategoryId = input.categoryId || input.id || "";
    categoryId = typeof inputCategoryId === "string" ? inputCategoryId : "";
    yearMonth = typeof input.yearMonth === "string" ? input.yearMonth : "";
    amountToAdd = Number(input.amount || 0);
  } else if (typeof input === "string") {
    categoryId = input;
  }

  if (typeof arg2 === "number") {
    amountToAdd = arg2;
  } else if (typeof arg2 === "string") {
    yearMonth = arg2;
  }

  if (typeof arg3 === "string") {
    yearMonth = arg3;
  } else if (typeof arg3 === "number") {
    amountToAdd = arg3;
  }

  if (!yearMonth) {
    yearMonth = getJstYearMonth();
  }
  if (!isValidYearMonth(yearMonth)) return;

  if (!categoryId || typeof categoryId !== "string" || !isValidAmount(amountToAdd)) {
    return;
  }

  if (!(await addToCategoryBudget(user.id, categoryId, yearMonth, amountToAdd))) return;

  revalidatePath("/");
}