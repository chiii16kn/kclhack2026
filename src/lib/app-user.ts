import { prisma } from "@/lib/prisma";

// Supabase の認証ユーザーに対応する家計簿ユーザー(Prisma側)を用意します。
// すでにあれば何もしません。サインアップ時に DB 登録が失敗していても、
// 次にトップページを開いたときにここで作り直されます。
export async function ensureAppUser(id: string, email: string) {
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id, // SupabaseのユーザーIDと同じIDをセットして紐付ける
      email,
      // ユーザー作成と同時に初期の「口座」を作る
      accounts: {
        create: [
          { name: "現金 (財布)" },
          { name: "メインバンク" },
        ],
      },
      // ユーザー作成と同時に初期の「カテゴリ(袋)」を作る
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
}
