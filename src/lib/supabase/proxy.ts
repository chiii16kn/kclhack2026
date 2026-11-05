import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment } from "./env";

// リクエストのたびにセッショントークンを検証・更新します。
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnvironment();
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // 認証 cookie を含むレスポンスが CDN 等にキャッシュされないようにします。
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // createServerClient と getClaims() の間にコードを挟まないでください。
  // getClaims() が期限切れトークンの更新を行うため、
  // 削除するとユーザーが不規則にログアウトされる原因になります。
  await supabase.auth.getClaims();

  // 公式のコード例にはここに「未ログインなら /login へリダイレクト」する処理が
  // ありますが、このアプリは商品閲覧を公開しているため入れていません。

  // supabaseResponse は cookie を保持しているため、必ずそのまま返してください。
  return supabaseResponse;
}
