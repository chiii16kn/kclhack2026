// src/app/api/line/webhook/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const events = body.events || [];

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const replyToken = event.replyToken;
        const text: string = event.message.text.trim();

        // 1. テキスト解析 (例: "食費 1200", "収入 50000")
        const parts = text.split(/[\s ]+/);
        let categoryName = "";
        let amount = 0;

        if (parts.length >= 2 && !isNaN(Number(parts[1]))) {
          categoryName = parts[0];
          amount = Number(parts[1]);
        } else if (parts.length === 1 && !isNaN(Number(parts[0]))) {
          categoryName = "食費";
          amount = Number(parts[0]);
        } else {
          await replyLine(
            replyToken,
            `💡 登録の形式:\n【支出】「カテゴリ名 金額」（例: 食費 1200）\n【収入】「収入 金額」（例: 収入 50000）`
          );
          continue;
        }

        // 2. ユーザーの取得 (データが存在しない場合は作成)
        let user = await prisma.user.findFirst({
          include: {
            categories: true,
            accounts: true,
          },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: "default@example.com",
              accounts: { create: { name: "現金（財布）" } },
              categories: {
                create: [
                  { name: "食費" },
                  { name: "日用品" },
                  { name: "交際費" },
                  { name: "家賃固定費", isFixed: true },
                ],
              },
            },
            include: { categories: true, accounts: true },
          });
        }

        const today = new Date();
        const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

        // 3. 収入キーワードの判定 (収入、給料、入金、ボーナス、手当)
        const incomeKeywords = ["収入", "給料", "入金", "ボーナス", "手当"];
        const isIncome = incomeKeywords.some((keyword) =>
          categoryName.includes(keyword)
        );

        if (isIncome) {
          // 収入データ更新（既存の当月収入があれば加算、無ければ新規作成）
          const currentIncome = await prisma.monthlyIncome.findFirst({
            where: {
              userId: user.id,
              yearMonth: currentYearMonth,
            },
          });

          const newTotal = (currentIncome?.amount ?? 0) + amount;

          if (currentIncome) {
            await prisma.monthlyIncome.update({
              where: { id: currentIncome.id },
              data: { amount: newTotal },
            });
          } else {
            await prisma.monthlyIncome.create({
              data: {
                userId: user.id,
                yearMonth: currentYearMonth,
                amount: newTotal,
              },
            });
          }

          const responseMsg = `💰 今月の収入に ¥${amount.toLocaleString()} を追加しました！\n\n今月の総収入: ¥${newTotal.toLocaleString()}`;
          await replyLine(replyToken, responseMsg);
          continue;
        }

        // 4. 口座の確認 (無ければ自動生成)
        let account = user.accounts[0];
        if (!account) {
          account = await prisma.account.create({
            data: { userId: user.id, name: "現金（財布）" },
          });
        }

        // 5. カテゴリの検索 (無ければ作成)
        let category = user.categories.find(
          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
        );

        if (!category) {
          category = await prisma.category.create({
            data: {
              userId: user.id,
              name: categoryName,
            },
          });
        }

        // 6. 支出データ (Transaction) の記録
        await prisma.transaction.create({
          data: {
            userId: user.id,
            accountId: account.id,
            categoryId: category.id,
            type: "EXPENSE",
            amount: amount,
            memo: "LINEクイック登録",
          },
        });

        // 7. 今月の残額 & 1日あたりの残枠計算
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(1, lastDay - today.getDate() + 1);

        const budgetData = await prisma.monthlyBudget.findFirst({
          where: {
            categoryId: category.id,
            yearMonth: currentYearMonth,
          },
        });

        const catBudget = budgetData?.amount ?? 0;

        const transactions = await prisma.transaction.findMany({
          where: {
            categoryId: category.id,
            type: "EXPENSE",
            date: {
              gte: new Date(today.getFullYear(), today.getMonth(), 1),
              lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
            },
          },
        });

        const catExpense = transactions.reduce((sum, t) => sum + t.amount, 0);
        const remainingBudget = catBudget - catExpense;

        const dailyAvailable =
          !category.isFixed && remainingBudget > 0
            ? Math.floor(remainingBudget / remainingDays)
            : 0;

        // 8. 返信メッセージの生成
        let responseMsg = `📝 【${category.name}】に ¥${amount.toLocaleString()} を記録しました！\n\n📁 カテゴリ今月残額: ¥${remainingBudget.toLocaleString()}\n`;

        if (!category.isFixed) {
          responseMsg += `🗓️ 今日以降1日使える額: ¥${dailyAvailable.toLocaleString()} /日 (残り${remainingDays}日)`;
        }

        // 予算オーバー時の処理分岐
        if (remainingBudget < 0) {
          const overAmount = Math.abs(remainingBudget);
          const mode = user.overBudgetMode || "COMPENSATE";

          if (mode === "COMPENSATE") {
            let candidateText = "";
            for (const otherCat of user.categories) {
              if (otherCat.id === category.id) continue;
              const bData = await prisma.monthlyBudget.findFirst({
                where: {
                  categoryId: otherCat.id,
                  yearMonth: currentYearMonth,
                },
              });
              const bTrans = await prisma.transaction.findMany({
                where: {
                  categoryId: otherCat.id,
                  type: "EXPENSE",
                  date: {
                    gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
                  },
                },
              });
              const rem = (bData?.amount ?? 0) - bTrans.reduce((sum, t) => sum + t.amount, 0);
              if (rem > 0) {
                candidateText += `\n・${otherCat.name} (残額: ¥${rem.toLocaleString()})`;
              }
            }

            responseMsg += `\n\n🚨 予算が ¥${overAmount.toLocaleString()} 不足しています！\n以下のカテゴリから補填を検討してください:${candidateText || "\n(補填可能な余剰カテゴリがありません)"}`;
          } else {
            responseMsg += `\n\n⚠️ 【警告】予算超過中！(¥${overAmount.toLocaleString()} マイナス)`;
          }
        }

        await replyLine(replyToken, responseMsg);
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("LINE Webhook Error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function replyLine(replyToken: string, messageText: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: LINE_HEADER,
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: messageText }],
    }),
  });
}