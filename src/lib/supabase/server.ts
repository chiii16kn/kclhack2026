import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment } from "./env";

// サーバー(Server Component / Route Handler / Server Action)から使う
// Supabase クライアントです。セッションは cookie で管理されます。
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnvironment();

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component からは cookie を書き込めませんが、
            // proxy がセッションを更新するため問題ありません。
          }
        },
      },
    },
  );
}
