// src/app/actions/user.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { revalidatePath } from "next/cache";

export async function updateOverBudgetMode(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const targetUserId = user.id;

  const mode = getFormDataString(formData, "overBudgetMode");
  if (mode !== "COMPENSATE" && mode !== "WARNING") return;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { overBudgetMode: mode },
  });

  revalidatePath("/");
}

// 毎晩21時のLINE通知のオン・オフを切り替える
export async function updateDailyReminder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const value = getFormDataString(formData, "dailyReminderEnabled");
  if (value !== "true" && value !== "false") return;

  await prisma.user.update({
    where: { id: user.id },
    data: { dailyReminderEnabled: value === "true" },
  });

  revalidatePath("/");
}
