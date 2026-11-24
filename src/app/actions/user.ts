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