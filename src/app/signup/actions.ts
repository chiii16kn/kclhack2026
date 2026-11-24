// src/app/signup/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/app-user";
import { getFormDataString } from "@/lib/form-data";

export async function signup(formData: FormData) {
  // ① 画面の入力フォームからメールアドレスとパスワードを受け取る
  const email = getFormDataString(formData, "email");
  const password = getFormDataString(formData, "password");

  // ② Supabaseの認証機能を使ってユーザーを作成する
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect("/signup?error=failed");
  }

  // ③ Supabase側で認証ユーザーが作られたら、Prisma（家計簿データベース）側にもデータを登録する
  //    （初期の口座・カテゴリも一緒に作る。失敗してもトップページ表示時に作り直される）
  if (data.user) {
    if (data.user.email) {
      try {
        await ensureAppUser(data.user.id, data.user.email);
      } catch (e) {
        console.error("Prismaユーザー作成エラー:", e);
      }
    } else {
      console.error("Prismaユーザー作成エラー:", new Error("Supabase user email is missing"));
    }
  }

  // ④ 処理が終わったら最新状態に更新して、トップページへリダイレクト（移動）する
  revalidatePath("/", "layout");
  redirect("/");
}