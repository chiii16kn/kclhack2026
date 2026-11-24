// src/app/actions/category.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { isValidAmount } from "@/lib/amount";
import { getJstYearMonth } from "@/lib/date-jst";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { revalidatePath } from "next/cache";

export type CreateCategoryState = {
  success: boolean;
  message: string;
};

export async function createCategory(
  _previousState: CreateCategoryState,
  formData: FormData,
): Promise<CreateCategoryState> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, message: "ログインしてからカテゴリを追加してください。" };
  }

  const name = getFormDataString(formData, "name").trim();
  const expenseType = getFormDataString(formData, "expenseType");
  const amountValue = formData.get("monthlyBudget");

  if (!name || name.length > 40) {
    return { success: false, message: "カテゴリ名は1〜40文字で入力してください。" };
  }
  if (expenseType !== "FIXED" && expenseType !== "VARIABLE") {
    return { success: false, message: "固定費または変動費を選択してください。" };
  }

  const isFixed = expenseType === "FIXED";
  const amount = amountValue === null || amountValue === "" ? NaN : Number(amountValue);
  if (isFixed && !isValidAmount(amount)) {
    return { success: false, message: "固定費の月額予算を1円以上で入力してください。" };
  }

  const existingCategory = await prisma.category.findFirst({
    where: { userId: user.id, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingCategory) {
    return { success: false, message: "同じ名前のカテゴリがすでにあります。" };
  }

  const yearMonth = getJstYearMonth();

  try {
    await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          userId: user.id,
          name,
          isFixed,
        },
      });

      if (isFixed) {
        await tx.monthlyBudget.create({
          data: {
            userId: user.id,
            categoryId: category.id,
            yearMonth,
            amount,
          },
        });
      }
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: "同じ名前のカテゴリがすでにあります。" };
    }
    throw error;
  }

  revalidatePath("/");
  return { success: true, message: `「${name}」を追加しました。` };
}

export async function updateCategorySettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const categoryId = getFormDataString(formData, "categoryId");
  const countType = getFormDataString(formData, "countType");
  const countValue = Number(formData.get("countValue"));
  const mergeSameDay = formData.get("mergeSameDay") === "true";

  if (!categoryId) return;
  if (countType !== "DAILY" && countType !== "MONTHLY_COUNT") return;
  if (!Number.isSafeInteger(countValue) || countValue < 1 || countValue > 1000) return;

  await prisma.category.update({
    where: { id: categoryId, userId: user.id },
    data: {
      countType,
      countValue,
      mergeSameDay,
    },
  });

  revalidatePath("/");
}