// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { updateMonthlyIncome, updateCategoryBudget } from "@/app/actions/budget";
import { updateOverBudgetMode } from "@/app/actions/user";
import { addTransaction } from "@/app/actions/transaction";
import ActionRequiredModal from "@/components/ActionRequiredModal";
import CategorySettingsButton from "@/components/CategorySettingsButton";

const getCategoryIcon = (name: string) => {
  if (name.includes("食")) return "🍔";
  if (name.includes("日用")) return "🧻";
  if (name.includes("交際") || name.includes("遊")) return "☕";
  if (name.includes("家賃") || name.includes("固定") || name.includes("住")) return "🏠";
  if (name.includes("交通") || name.includes("車")) return "🚃";
  return "🍎";
};

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFBFE] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center border-2 border-orange-100">
          <p className="mb-6 text-gray-600 font-medium">家計簿を利用するにはログインしてください 🐻</p>
          <Link href="/login" className="px-6 py-3 bg-orange-400 text-white font-bold rounded-full hover:bg-orange-500 transition-transform hover:scale-105 inline-block">
            ログイン画面へ
          </Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, lastDayOfMonth - today.getDate() + 1);

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      accounts: true,
      incomes: { where: { yearMonth: currentYearMonth } },
      categories: {
        include: {
          budgets: { where: { yearMonth: currentYearMonth } },
          transactions: {
            where: {
              type: "EXPENSE",
              date: {
                gte: new Date(today.getFullYear(), today.getMonth(), 1),
                lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
              },
            },
          },
        },
      },
    },
  });

  if (!userData) return <div>データの読み込みに失敗しました。</div>;

  const totalIncome = userData.incomes[0]?.amount ?? 0;

  const totalAllocated = userData.categories.reduce(
    (sum: number, cat: any) => sum + (cat.budgets[0]?.amount ?? 0),
    0
  );

  const unallocatedAmount = totalIncome - totalAllocated;

  const totalExpense = userData.categories.reduce(
    (sum: number, cat: any) => sum + cat.transactions.reduce((tSum: number, t: any) => tSum + t.amount, 0),
    0
  );

  const currentMode = userData.overBudgetMode || "COMPENSATE";

  // 赤字のカテゴリを抽出
  const overCategories = userData.categories.map(cat => {
    const budget = cat.budgets[0]?.amount ?? 0;
    const expense = cat.transactions.reduce((tSum, t) => tSum + t.amount, 0);
    return {
      id: cat.id,
      name: cat.name,
      remaining: budget - expense,
    };
  }).filter(cat => cat.remaining < 0);

  // モーダルを表示するかどうかの判定
  const needsAction = unallocatedAmount !== 0 || overCategories.length > 0;

  // モーダル用に追加：全カテゴリの簡易リスト
  const allCategories = userData.categories.map(c => ({ id: c.id, name: c.name }));

  return (
    <main className="min-h-screen bg-[#FFFBFE] pb-12 font-sans text-gray-800">
      {/* 警告モーダルの呼び出し */}
      {needsAction && (
        <ActionRequiredModal
          unallocatedAmount={unallocatedAmount}
          overCategories={overCategories}
          allCategories={allCategories}
          currentYearMonth={currentYearMonth}
        />
      )}

      <div className="max-w-3xl mx-auto p-4 space-y-6 pt-6">

        {/* ヘッダー & 未配分プール */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-orange-100 space-y-5">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-extrabold text-orange-500 flex items-center gap-2">
              <span>🐻</span><span>Pocke</span> <span className="text-sm font-medium text-gray-400 ml-2">{currentYearMonth}</span>
            </h1>
            {unallocatedAmount === 0 && totalIncome > 0 ? (
              <span className="bg-green-100 text-green-700 text-sm font-bold px-4 py-1.5 rounded-full">✨ ぜんぶ配分できたよ！</span>
            ) : unallocatedAmount < 0 ? (
              <span className="bg-red-100 text-red-700 text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">⚠️ {Math.abs(unallocatedAmount).toLocaleString()}円 オーバー！</span>
            ) : (
              <span className="bg-yellow-100 text-yellow-700 text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">未配分: ¥{unallocatedAmount.toLocaleString()}</span>
            )}
          </div>

          <div className="flex justify-between items-center bg-orange-50/50 p-3 rounded-2xl text-sm">
            <div>
              <span className="font-semibold text-gray-600">予算オーバー時のルール: </span>
              <span className="ml-2 font-bold text-orange-600">
                {currentMode === "COMPENSATE" ? "🔄 補填（他からカバー）" : "⚠️ マイナス強調（警告のみ）"}
              </span>
            </div>
            <form action={updateOverBudgetMode}>
              <input type="hidden" name="overBudgetMode" value={currentMode === "COMPENSATE" ? "WARNING" : "COMPENSATE"} />
              <button type="submit" className="px-3 py-1.5 bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-100 rounded-full text-xs font-bold transition-transform active:scale-95">
                変更する
              </button>
            </form>
          </div>

          <form action={updateMonthlyIncome} className="flex items-center gap-3 bg-[#FFFBFE] p-4 rounded-2xl border border-orange-50">
            {/* ▼ 手動保存が効かない原因だったパラメータを追加 ▼ */}
            <input type="hidden" name="yearMonth" value={currentYearMonth} />
            
            <label className="text-sm font-bold text-gray-600 whitespace-nowrap">今月使えるお金（収入）：</label>
            <input key={totalIncome} type="number" name="amount" defaultValue={totalIncome} placeholder="250000" className="flex-1 max-w-[160px] px-4 py-2 border-2 border-orange-100 rounded-full text-right font-bold focus:outline-none focus:border-orange-300" />
            <button type="submit" className="px-5 py-2 bg-orange-500 text-white rounded-full text-sm font-bold hover:bg-orange-600 transition-transform active:scale-95 shadow-sm">
              保存
            </button>
          </form>
          
          <div className="grid grid-cols-3 gap-4 pt-4 text-center border-t border-gray-100">
            <div><p className="text-xs font-bold text-gray-400 mb-1">配分した合計</p><p className="text-lg font-extrabold text-gray-700">¥{totalAllocated.toLocaleString()}</p></div>
            <div><p className="text-xs font-bold text-gray-400 mb-1">使ったお金</p><p className="text-lg font-extrabold text-rose-500">¥{totalExpense.toLocaleString()}</p></div>
            <div><p className="text-xs font-bold text-gray-400 mb-1">ぜんぶの残金</p><p className="text-lg font-extrabold text-teal-500">¥{(totalIncome - totalExpense).toLocaleString()}</p></div>
          </div>
        </div>

        {/* 手動支出登録フォーム */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border-2 border-blue-50 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -z-10 opacity-50"></div>
          <h2 className="text-lg font-extrabold text-blue-600 flex items-center gap-2">
            <span>✍️</span> 支出をメモする
          </h2>
          <form action={addTransaction} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs font-bold text-gray-500">どの袋？</label>
              <select name="categoryId" className="px-4 py-2.5 border-2 border-gray-100 rounded-full text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-200">
                <option value="">選んでね</option>
                {userData.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{getCategoryIcon(cat.name)} {cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="text-xs font-bold text-gray-500">いくら？</label>
              <div className="flex items-center gap-1">
                <input type="number" name="amount" placeholder="1000" className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-full text-sm text-right bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-200" />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs font-bold text-gray-500">メモ（任意）</label>
              <input type="text" name="memo" placeholder="スーパー" className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-full text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-200" />
            </div>
            <button type="submit" className="px-6 py-2.5 bg-blue-500 text-white rounded-full text-sm font-bold hover:bg-blue-600 transition-transform active:scale-95 shadow-sm">
              記録！
            </button>
          </form>
        </section>

        {/* カテゴリ（袋）別 予算配分 */}
        <section className="space-y-4">
          <div className="flex justify-between items-end px-2">
            <h2 className="text-xl font-extrabold text-gray-700">👜 わたしの袋</h2>
            <span className="text-sm font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">月末まであと {remainingDays} 日</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {userData.categories.map((category) => {
              const budget = category.budgets[0]?.amount ?? 0;
              const expense = category.transactions.reduce((sum, t) => sum + t.amount, 0);
              const remainingBudget = budget - expense;
              
              // DAILY 以外が指定されていれば回数割モードとして判定
              const isCountMode = Boolean(category.countType && category.countType !== "DAILY" && category.countType !== "DAY");
              const countTarget = category.countValue && category.countValue > 0 ? category.countValue : 1;
              
              // 同日まとめ設定がONなら利用した「日」の数をカウント、OFFなら単純な決済件数
              const usedCount = category.mergeSameDay 
                ? new Set(category.transactions.map(t => new Date(t.date).getDate())).size 
                : category.transactions.length;
              
              // 残りの目標回数（最小1回）
              const remainingCount = Math.max(1, countTarget - usedCount);
              
              // 1回あたり / 1日あたりの利用可能額
              const availablePerUnit = !category.isFixed && remainingBudget > 0 
                ? Math.floor(remainingBudget / (isCountMode ? remainingCount : remainingDays)) 
                : 0;
                
              const unitLabel = isCountMode ? "1回" : "1日";

              const expensePercent = budget > 0 ? Math.min(100, Math.max(0, (expense / budget) * 100)) : 0;
              const isOver = remainingBudget < 0;

              return (
                <div key={category.id} className={`p-5 rounded-3xl shadow-sm border-2 ${isOver ? 'bg-rose-50 border-rose-100' : 'bg-white border-gray-100'} space-y-3 relative overflow-hidden`}>
                  <div className="flex justify-between items-start">
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{getCategoryIcon(category.name)}</span>
                        <span className="font-extrabold text-lg text-gray-800">{category.name}</span>
                        {category.isFixed && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">固定費</span>}
                        <CategorySettingsButton category={category} />
                      </div>
                      <span className="text-xs font-bold text-gray-400 pl-1">
                        残額: <span className={`text-base ${isOver ? 'text-rose-600' : 'text-gray-800'}`}>¥{remainingBudget.toLocaleString()}</span>
                      </span>
                    </div>
                    
                    <form action={updateCategoryBudget} className="flex flex-col items-end gap-1">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="yearMonth" value={currentYearMonth} />
                      <div className="flex items-center gap-1">
                        <input type="number" name="amount" defaultValue={budget} className="w-20 px-2 py-1 border-2 border-gray-100 rounded-lg text-right text-sm font-bold bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-200" />
                        <span className="text-xs font-bold text-gray-400">円</span>
                      </div>
                      <button type="submit" className="px-3 py-1 bg-gray-800 text-white rounded-full text-xs font-bold hover:bg-gray-700 transition-transform active:scale-95">配分</button>
                    </form>
                  </div>
                  
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${isOver ? 'bg-rose-500' : 'bg-teal-400'}`} style={{ width: `${expensePercent}%` }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-bold pt-2">
                    <span className="text-gray-400">消化: ¥{expense.toLocaleString()}</span>
                    {!category.isFixed && (
                      <span className="bg-white text-teal-600 px-3 py-1 rounded-full shadow-sm border border-teal-100">
                        {unitLabel}: <strong>¥{availablePerUnit.toLocaleString()}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}