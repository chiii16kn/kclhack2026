// src/app/actions/transaction.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // ログインユーザーがいない場合は DB の先頭ユーザーを取得（検証用）
  const targetUserId = user?.id || (await prisma.user.findFirst())?.id;
  if (!targetUserId) return;

  const categoryId = formData.get("categoryId") as string;
  const amount = Number(formData.get("amount"));
  const memo = formData.get("memo") as string || "Web手動登録";

  if (!categoryId || isNaN(amount) || amount <= 0) return;

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