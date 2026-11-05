// src/app/actions/resolve.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ① 赤字の袋を補填する処理
export async function resolveDeficit(
  input: any,
  argYearMonth?: string,
  argAmount?: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let categoryId = "";
  let yearMonth = "";
  let amountToCover = 0;

  // 引数の形式（FormData / オブジェクト / 文字列）に応じて値を抽出
  if (input instanceof FormData) {
    categoryId = (input.get("categoryId") as string) || "";
    yearMonth = (input.get("yearMonth") as string) || "";
    amountToCover = Number(input.get("amount") || 0);
  } else if (typeof input === "object" && input !== null) {
    categoryId = input.categoryId || input.id || "";
    yearMonth = input.yearMonth || "";
    amountToCover = Number(input.amount || Math.abs(input.remaining || 0));
  } else if (typeof input === "string") {
    categoryId = input;
  }

  if (argYearMonth && typeof argYearMonth === "string") {
    yearMonth = argYearMonth;
  }
  if (argAmount && typeof argAmount === "number") {
    amountToCover = argAmount;
  }

  // 年月が空の場合は当月を自動設定
  const today = new Date();
  if (!yearMonth) {
    yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }

  // categoryId が正しく取得できていない場合は処理を安全に中断
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
        categoryId,
        type: "EXPENSE",
        date: {
          gte: new Date(today.getFullYear(), today.getMonth(), 1),
          lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        },
      },
    });
    const totalExpense = transactions.reduce((sum, t) => sum + t.amount, 0);
    const budgetAmount = budget?.amount ?? 0;
    if (totalExpense > budgetAmount) {
      amountToCover = totalExpense - budgetAmount;
    }
  }

  if (amountToCover <= 0) return;

  const currentBudget = await prisma.monthlyBudget.findFirst({
    where: { userId: user.id, categoryId, yearMonth },
  });

  if (currentBudget) {
    await prisma.monthlyBudget.update({
      where: { id: currentBudget.id },
      data: { amount: currentBudget.amount + amountToCover },
    });
  } else {
    await prisma.monthlyBudget.create({
      data: {
        userId: user.id,
        categoryId,
        yearMonth,
        amount: amountToCover,
      },
    });
  }

  revalidatePath("/");
}

// ② 未配分プールから指定の袋に予算を追加する処理
export async function quickAllocate(
  input: any,
  argYearMonth?: string,
  argAmount?: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let categoryId = "";
  let yearMonth = "";
  let amountToAdd = 0;

  if (input instanceof FormData) {
    categoryId = (input.get("categoryId") as string) || "";
    yearMonth = (input.get("yearMonth") as string) || "";
    amountToAdd = Number(input.get("amount") || 0);
  } else if (typeof input === "object" && input !== null) {
    categoryId = input.categoryId || input.id || "";
    yearMonth = input.yearMonth || "";
    amountToAdd = Number(input.amount || 0);
  } else if (typeof input === "string") {
    categoryId = input;
  }

  if (argYearMonth && typeof argYearMonth === "string") {
    yearMonth = argYearMonth;
  }
  if (argAmount && typeof argAmount === "number") {
    amountToAdd = argAmount;
  }

  const today = new Date();
  if (!yearMonth) {
    yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }

  if (!categoryId || typeof categoryId !== "string" || !amountToAdd || amountToAdd <= 0) {
    return;
  }

  const currentBudget = await prisma.monthlyBudget.findFirst({
    where: { userId: user.id, categoryId, yearMonth },
  });

  if (currentBudget) {
    await prisma.monthlyBudget.update({
      where: { id: currentBudget.id },
      data: { amount: currentBudget.amount + amountToAdd },
    });
  } else {
    await prisma.monthlyBudget.create({
      data: {
        userId: user.id,
        categoryId,
        yearMonth,
        amount: amountToAdd,
      },
    });
  }

  revalidatePath("/");
}