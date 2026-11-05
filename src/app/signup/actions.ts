// src/app/signup/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma"; // Prismaを使ってDBを操作するためのツール

export async function signup(formData: FormData) {
  // ① 画面の入力フォームからメールアドレスとパスワードを受け取る
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // ② Supabaseの認証機能を使ってユーザーを作成する
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect("/error");
  }

  // ③ Supabase側で認証ユーザーが作られたら、Prisma（家計簿データベース）側にもデータを登録する
  if (data.user) {
    try {
      // prisma.user.create で新しいユーザーデータを作成
      await prisma.user.create({
        data: {
          id: data.user.id, // SupabaseのユーザーIDと同じIDをセットして紐付ける
          email: data.user.email!,
          
          // accounts: { create: [...] } で、ユーザー作成と同時に初期の「口座」を作る
          accounts: {
            create: [
              { name: "現金 (財布)" },
              { name: "メインバンク" },
            ],
          },

          // categories: { create: [...] } で、ユーザー作成と同時に初期の「カテゴリ(袋)」を作る
          categories: {
            create: [
              { name: "食費", isFixed: false },
              { name: "日用品", isFixed: false },
              { name: "交際費", isFixed: false },
              { name: "家賃", isFixed: true }, // 固定費フラグを立てておく
            ],
          },
        },
      });
    } catch (e) {
      console.error("Prismaユーザー作成エラー:", e);
      // 万が一DBエラーが起きてもとりあえず処理は進める
    }
  }

  // ④ 処理が終わったら最新状態に更新して、トップページへリダイレクト（移動）する
  revalidatePath("/", "layout");
  redirect("/");
}