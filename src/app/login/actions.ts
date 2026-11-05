"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFormDataString } from "@/lib/form-data";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = getFormDataString(formData, "email");
  const password = getFormDataString(formData, "password");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid");
  }

  revalidatePath("/", "layout");
  redirect("/");
}
