// src/app/actions/transaction.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { isValidAmount } from "@/lib/amount";
import { revalidatePath } from "next/cache";

export async function addTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const targetUserId = user.id;

  const categoryId = getFormDataString(formData, "categoryId");
  const amount = Number(formData.get("amount"));
  const memo = getFormDataString(formData, "memo") || "Web手動登録";

  if (!categoryId || !isValidAmount(amount)) return;

  // 自分のカテゴリ以外には記録させない
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: targetUserId },
    select: { id: true },
  });
  if (!category) return;

  // デフォルト口座を取得（無ければ自動生成）
  let account = await prisma.account.findFirst({
    where: { userId: targetUserId }
  });

  if (!account) {
    account = await prisma.account.create({
      data: { userId: targetUserId, name: "現金 (財布)" }
    });
  }

  // 支出データを記録
  await prisma.transaction.create({
    data: {
      userId: targetUserId,
      accountId: account.id,
      categoryId,
      type: "EXPENSE",
      amount,
      memo,
    },
  });

  // 画面を再読み込みして最新の残高を反映
  revalidatePath("/");
}
