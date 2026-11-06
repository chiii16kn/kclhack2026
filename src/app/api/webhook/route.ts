// src/app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    if (!isValidLineSignature(rawBody, req.headers.get("x-line-signature"))) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }

    const parsedBody: unknown = JSON.parse(rawBody);
    if (!isRecord(parsedBody)) {
      throw new TypeError("Invalid LINE webhook payload");
    }
    const body = parsedBody;
    const events = body.events || [];
    if (!isUnknownArray(events)) {
      throw new TypeError("Invalid LINE webhook events");
    }

    for (const rawEvent of events) {
      if (!isRecord(rawEvent)) {
        throw new TypeError("Invalid LINE webhook event");
      }
      const event = rawEvent;
      if (event.type === "message") {
        if (!isRecord(event.message)) {
          throw new TypeError("Invalid LINE webhook message");
        }
        const message = event.message;
        if (message.type !== "text") continue;
        if (typeof event.replyToken !== "string" || typeof message.text !== "string") {
          throw new TypeError("Invalid LINE text message");
        }
        const replyToken = event.replyToken;
        const text = message.text.trim();
        const source = event.source;
        const lineUserId = isRecord(source) ? source.userId : undefined;

        if (typeof lineUserId !== "string" || !lineUserId) {
          await replyLine(replyToken, "LINEユーザーを識別できませんでした。個別トークでお試しください。");
          continue;
        }

        if (/^\d{6}$/.test(text)) {
          const linkResult = await linkLineAccount(text, lineUserId);
          const responseMessage =
            linkResult === "linked"
              ? "アカウントの連携が完了しました！以降は入力した金額が家計簿に反映されます。"
              : linkResult === "already-linked"
                ? "このLINEアカウントは別の家計簿アカウントと連携済みです。"
                : "無効なコード、または期限切れです。Web画面から再発行してください。";
          await replyLine(replyToken, responseMessage);
          continue;
        }

        const user = await prisma.user.findUnique({
          where: { lineId: lineUserId },
          include: {
            categories: true,
            accounts: true,
          },
        });

        if (!user) {
          await replyLine(
            replyToken,
            "Web画面からログインし、ワンタイムパスワードを発行・送信して連携を完了させてください。",
          );
          continue;
        }

        // 1. テキスト解析 (例: "食費 1200", "収入 50000")
        const parts = text.split(/\s+/);
        let categoryName = "";
        let amount = 0;

        if (parts.length >= 2 && Number.isSafeInteger(Number(parts[1])) && Number(parts[1]) > 0) {
          categoryName = parts[0];
          amount = Number(parts[1]);
        } else if (parts.length === 1 && Number.isSafeInteger(Number(parts[0])) && Number(parts[0]) > 0) {
          categoryName = "食費";
          amount = Number(parts[0]);
        } else {
          await replyLine(
            replyToken,
            `💡 登録の形式:\n【支出】「カテゴリ名 金額」（例: 食費 1200）\n【収入】「収入 金額」（例: 収入 50000）`
          );
          continue;
        }

        const today = new Date();
        const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

        // 3. 収入キーワードの判定 (収入、給料、入金、ボーナス、手当)
        const incomeKeywords = ["収入", "給料", "入金", "ボーナス", "手当"];
        const isIncome = incomeKeywords.some((keyword) =>
          categoryName.includes(keyword)
        );

        if (isIncome) {
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

        // 4. 口座の確認
        let account = user.accounts[0];
        if (!account) {
          account = await prisma.account.create({
            data: { userId: user.id, name: "現金（財布）" },
          });
        }

        // 5. カテゴリの検索 (▼ c: { name: string } 型定義を追加 ▼)
        let category = user.categories.find(
          (c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
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

        // 7. 今月の残額 & 1日/1回あたりの残枠計算
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
              lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
            },
          },
        });

        const catExpense = transactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
        const remainingBudget = catBudget - catExpense;
        const isCountMode = category.countType !== "DAILY" && category.countType !== "DAY";
        const countTarget = category.countValue > 0 ? category.countValue : 1;
        const usedCount = category.mergeSameDay
          ? new Set(transactions.map((transaction) => new Date(transaction.date).getDate())).size
          : transactions.length;
        const remainingCount = Math.max(1, countTarget - usedCount);
        const remainingUnits = isCountMode ? remainingCount : remainingDays;

        const dailyAvailable =
          !category.isFixed && remainingBudget > 0
            ? Math.floor(remainingBudget / remainingUnits)
            : 0;

        // 8. 返信メッセージの生成
        let responseMsg = `📝 【${category.name}】に ¥${amount.toLocaleString()} を記録しました！\n\n📁 カテゴリ今月残額: ¥${remainingBudget.toLocaleString()}\n`;

        if (!category.isFixed) {
          const unitLabel = isCountMode ? "1回" : "1日";
          const remainingLabel = isCountMode ? "回" : "日";
          responseMsg += `🗓️ 今日以降${unitLabel}使える額: ¥${dailyAvailable.toLocaleString()} /${unitLabel} (残り${remainingUnits}${remainingLabel})`;
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
                    lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
                  },
                },
              });
              const rem = (bData?.amount ?? 0) - bTrans.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
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

function isValidLineSignature(body: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) {
    console.error("LINE_CHANNEL_SECRET or x-line-signature is missing");
    return false;
  }

  const expected = createHmac("sha256", channelSecret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

type LineLinkResult = "linked" | "invalid" | "already-linked";

async function linkLineAccount(code: string, lineUserId: string): Promise<LineLinkResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const otp = await tx.otpCode.findUnique({ where: { code } });
      const now = new Date();

      if (!otp || otp.expiresAt <= now) {
        if (otp) {
          await tx.otpCode.deleteMany({ where: { id: otp.id } });
        }
        return "invalid";
      }

      const claimedOtp = await tx.otpCode.deleteMany({
        where: {
          id: otp.id,
          expiresAt: { gt: now },
        },
      });
      if (claimedOtp.count !== 1) return "invalid";

      await tx.user.update({
        where: { id: otp.userId },
        data: { lineId: lineUserId },
      });

      return "linked";
    });
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "P2002") {
      return "already-linked";
    }
    throw error;
  }
}

async function replyLine(replyToken: string, messageText: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
    return;
  }

  let response: Response;
  try {
    response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: messageText }],
      }),
    });
  } catch (error) {
    console.error("LINE reply request failed:", error);
    return;
  }

  if (!response.ok) {
    const responseBody = await response.text();
    console.error("LINE reply API error:", {
      status: response.status,
      body: responseBody.slice(0, 1000),
    });
  }
}