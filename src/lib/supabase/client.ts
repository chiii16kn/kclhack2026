import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "./env";

// ブラウザ(Client Component)から使う Supabase クライアントです。
export function createClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  return createBrowserClient(url, publishableKey);
}
