// src/app/actions/budget.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { revalidatePath } from "next/cache";

// ① 今月の総収入（利用可能総額）を保存・更新するアクション
export async function updateMonthlyIncome(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const yearMonth = getFormDataString(formData, "yearMonth");
  const amount = Number(formData.get("amount") || 0);

  if (!yearMonth) return;

  await prisma.monthlyIncome.upsert({
    where: {
      userId_yearMonth: {
        userId: user.id,
        yearMonth,
      },
    },
    update: { amount },
    create: {
      userId: user.id,
      yearMonth,
      amount,
    },
  });

  revalidatePath("/");
}

// ② 各カテゴリ（袋）への割り当て予算を保存・更新するアクション
export async function updateCategoryBudget(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const categoryId = getFormDataString(formData, "categoryId");
  const yearMonth = getFormDataString(formData, "yearMonth");
  const amount = Number(formData.get("amount") || 0);

  if (!categoryId || !yearMonth) return;

  await prisma.monthlyBudget.upsert({
    where: {
      categoryId_yearMonth: {
        categoryId,
        yearMonth,
      },
    },
    update: { amount },
    create: {
      userId: user.id,
      categoryId,
      yearMonth,
      amount,
    },
  });

  revalidatePath("/");
}