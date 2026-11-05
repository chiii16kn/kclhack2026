// src/app/actions/category.ts
"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";
import { revalidatePath } from "next/cache";

export async function updateCategorySettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const categoryId = getFormDataString(formData, "categoryId");
  const countType = getFormDataString(formData, "countType");
  const countValue = Number(formData.get("countValue"));
  const mergeSameDay = formData.get("mergeSameDay") === "true";

  if (!categoryId || !countType || isNaN(countValue)) return;

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