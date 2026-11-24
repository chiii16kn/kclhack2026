// src/app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isValidAmount, MAX_AMOUNT } from "@/lib/amount";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { calcPocket } from "@/lib/pocket";
import {
  getJstDateParts,
  getJstMonthRange,
  getJstRemainingDaysInMonth,
  getJstYearMonth,
} from "@/lib/date-jst";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

const UNDO_COMMANDS = ["取り消し", "取消", "取り消す", "とりけし"];
const BALANCE_COMMANDS = ["残高", "ざんだか", "残り", "のこり"];

// 「残高」コマンド: 袋ごとの今月の残額・計算方法・1日/1回あたり使える額をまとめる
async function buildBalanceMessage(user: {
  id: string;
  categories: {
    id: string;
    name: string;
    isFixed: boolean;
    countType: string;
    countValue: number;
    mergeSameDay: boolean;
  }[];
}): Promise<string> {
  const yearMonth = getJstYearMonth();
  const remainingDays = getJstRemainingDaysInMonth();

  const [budgets, transactions] = await Promise.all([
    prisma.monthlyBudget.findMany({
      where: { userId: user.id, yearMonth },
      select: { categoryId: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "EXPENSE", date: getJstMonthRange() },
      select: { categoryId: true, amount: true, date: true },
    }),
  ]);

  const { month } = getJstDateParts();
  const lines = [`👛 ${month}月の袋の残高（月末まであと${remainingDays}日）`];

  if (user.categories.length === 0) {
    lines.push("", "袋（カテゴリ）がまだありません。");
    return lines.join("\n");
  }

  for (const category of user.categories) {
    const budget = budgets.find((b) => b.categoryId === category.id)?.amount ?? 0;
    const pocket = calcPocket(
      category,
      budget,
      transactions.filter((t) => t.categoryId === category.id),
      remainingDays,
    );

    const status = pocket.remainingBudget < 0 ? "🚨" : "✅";
    lines.push(
      "",
      `${status}【${category.name}】残り ¥${pocket.remainingBudget.toLocaleString()}`,
      `　予算 ¥${pocket.budget.toLocaleString()} − 使用 ¥${pocket.expense.toLocaleString()}`,
    );

    if (category.isFixed) {
      lines.push("　計算: 固定費（1日/1回あたりの計算なし）");
      continue;
    }

    if (pocket.isCountMode) {
      const usedLabel = category.mergeSameDay ? "使った日数" : "使った回数";
      lines.push(
        `　計算: 回数割（月${pocket.countTarget}回・${usedLabel}${pocket.usedCount}回 → 残り${pocket.remainingUnits}回）`,
        `　1回あたり ¥${pocket.availablePerUnit.toLocaleString()}`,
      );
    } else {
      lines.push(
        `　計算: 日数割（残り${pocket.remainingUnits}日）`,
        `　1日あたり ¥${pocket.availablePerUnit.toLocaleString()}`,
      );
    }
  }

  return lines.join("\n");
}

function getMessageFormatPrompt(categoryNames: string[]): string {
  const availableCategories = ["収入", ...new Set(categoryNames.filter((name) => name !== "収入"))];

  return [
    "💡 次の形式で送信してください。",
    "【支出】「カテゴリ名 金額」（例: 食費 2000）",
    "【収入】「収入 金額」（例: 収入 50000）",
    `使用できるカテゴリ: ${availableCategories.join("、")}`,
    "【カテゴリ追加】「カテゴリ追加 名前 変動費」または「カテゴリ追加 名前 固定費 月額予算」",
    "例: カテゴリ追加 通信費 固定費 8000",
    "金額だけを送ると食費として登録します。",
    "【取り消し】「取り消し」と送ると直前の支出を削除します。",
    "【残高】「残高」と送ると袋ごとの残りと1日/1回あたり使える額を表示します。",
  ].join("\n");
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
      // 1件のイベントで失敗しても他のイベントは処理し、200 を返します。
      // （500 を返すと LINE が同じ Webhook を再送し、処理済みの支出が二重に記録されるため）
      try {
        await handleEvent(rawEvent);
      } catch (error) {
        console.error("LINE Webhook event error:", error);
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("LINE Webhook Error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function handleEvent(rawEvent: unknown): Promise<void> {
  if (!isRecord(rawEvent)) {
    console.error("Invalid LINE webhook event");
    return;
  }
  const event = rawEvent;
  if (event.type !== "message") return;
  if (!isRecord(event.message)) {
    console.error("Invalid LINE webhook message");
    return;
  }
  if (typeof event.replyToken !== "string") {
    console.error("Invalid LINE message reply token");
    return;
  }

  const replyToken = event.replyToken;
  const message = event.message;
  const source = event.source;
  const lineUserId = isRecord(source) ? source.userId : undefined;

  if (typeof lineUserId !== "string" || !lineUserId) {
    await replyLine(replyToken, "LINEユーザーを識別できませんでした。個別トークでお試しください。");
    return;
  }

  const isTextMessage = message.type === "text";
  const text = isTextMessage && typeof message.text === "string"
    ? message.text.trim()
    : null;

  if (text !== null && /^\d{6}$/.test(text)) {
    const linkResult = await linkLineAccount(text, lineUserId);
    const responseMessage =
      linkResult === "linked"
        ? "アカウントの連携が完了しました！以降は入力した金額が家計簿に反映されます。"
        : linkResult === "already-linked"
          ? "このLINEアカウントは別の家計簿アカウントと連携済みです。"
          : "無効なコード、または期限切れです。Web画面から再発行してください。";
    await replyLine(replyToken, responseMessage);
    return;
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
      "家計簿への記録にはアカウント連携が必要です。Web画面でユーザー登録・ログインし、表示されたワンタイム認証コードをLINEボット宛に送信してください。認証コードの有効期限は5分です。",
    );
    return;
  }

  if (text === null) {
    await replyLine(replyToken, getMessageFormatPrompt(user.categories.map((category) => category.name)));
    return;
  }

  // 袋ごとの残高を表示する
  if (BALANCE_COMMANDS.includes(text)) {
    await replyLine(replyToken, await buildBalanceMessage(user));
    return;
  }

  // 直前の支出を取り消す
  if (UNDO_COMMANDS.includes(text)) {
    const latest = await prisma.transaction.findFirst({
      where: { userId: user.id, type: "EXPENSE" },
      orderBy: { date: "desc" },
      include: { category: { select: { name: true } } },
    });
    if (!latest) {
      await replyLine(replyToken, "取り消せる支出がありません。");
      return;
    }

    const deleted = await prisma.transaction.deleteMany({
      where: { id: latest.id, userId: user.id },
    });
    if (deleted.count !== 1) {
      await replyLine(replyToken, "取り消しに失敗しました。もう一度お試しください。");
      return;
    }

    const { month, day } = getJstDateParts(latest.date);
    await replyLine(
      replyToken,
      `🗑️ 直前の支出を取り消しました。\n${month}/${day} 【${latest.category?.name ?? "カテゴリなし"}】 ¥${latest.amount.toLocaleString()}\n\n※収入の取り消しは、Web画面で今月の収入額を修正してください。`,
    );
    return;
  }

  if (text === "カテゴリ追加" || text.startsWith("カテゴリ追加 ")) {
    const categoryCommand = text.match(/^カテゴリ追加\s+(.+?)\s+(固定費|変動費)(?:\s+(\d+))?$/);
    if (!categoryCommand) {
      await replyLine(
        replyToken,
        "カテゴリ追加の形式が正しくありません。\n変動費: カテゴリ追加 名前 変動費\n固定費: カテゴリ追加 名前 固定費 月額予算\n例: カテゴリ追加 通信費 固定費 8000",
      );
      return;
    }

    const categoryName = categoryCommand[1].trim();
    const isFixed = categoryCommand[2] === "固定費";
    const monthlyBudget = categoryCommand[3] === undefined
      ? NaN
      : Number(categoryCommand[3]);

    if (
      !categoryName ||
      categoryName.length > 40 ||
      (isFixed && !isValidAmount(monthlyBudget)) ||
      (!isFixed && categoryCommand[3] !== undefined)
    ) {
      await replyLine(
        replyToken,
        "カテゴリ名は1〜40文字、固定費の月額予算は1円以上で指定してください。変動費には予算を指定しません。",
      );
      return;
    }

    const existingCategory = user.categories.find(
      (category) => category.name.toLowerCase() === categoryName.toLowerCase(),
    );
    if (existingCategory) {
      await replyLine(replyToken, `「${existingCategory.name}」はすでに登録されています。`);
      return;
    }

    const currentYearMonth = getJstYearMonth();
    try {
      await prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            userId: user.id,
            name: categoryName,
            isFixed,
          },
        });
        if (isFixed) {
          await tx.monthlyBudget.create({
            data: {
              userId: user.id,
              categoryId: category.id,
              yearMonth: currentYearMonth,
              amount: monthlyBudget,
            },
          });
        }
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        await replyLine(replyToken, `「${categoryName}」はすでに登録されています。`);
        return;
      }
      throw error;
    }

    await replyLine(
      replyToken,
      `カテゴリ「${categoryName}」（${isFixed ? `固定費・月額 ¥${monthlyBudget.toLocaleString()}` : "変動費"}）を追加しました。`,
    );
    return;
  }

  // 1. テキスト解析 (例: "食費 1200", "収入 50000")
  const parts = text.split(/\s+/);
  let categoryName = "";
  let amount = 0;

  if (parts.length === 2 && isValidAmount(Number(parts[1]))) {
    categoryName = parts[0];
    amount = Number(parts[1]);
  } else if (parts.length === 1 && isValidAmount(Number(parts[0]))) {
    categoryName = "食費";
    amount = Number(parts[0]);
  } else {
    await replyLine(replyToken, getMessageFormatPrompt(user.categories.map((category) => category.name)));
    return;
  }

  const currentYearMonth = getJstYearMonth();
  const monthRange = getJstMonthRange();

  // 3. 収入キーワードの判定 (収入、給料、入金、ボーナス、手当)
  //    「副収入」など同じ名前のカテゴリが登録されている場合はそのカテゴリへの支出として扱う
  const incomeKeywords = ["収入", "給料", "入金", "ボーナス", "手当"];
  const hasSameNameCategory = user.categories.some(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
  );
  const isIncome =
    categoryName === "収入" ||
    (!hasSameNameCategory && incomeKeywords.some((keyword) => categoryName.includes(keyword)));

  if (isIncome) {
    const currentIncome = await prisma.monthlyIncome.findFirst({
      where: {
        userId: user.id,
        yearMonth: currentYearMonth,
      },
    });
    if ((currentIncome?.amount ?? 0) + amount > MAX_AMOUNT) {
      await replyLine(replyToken, "今月の収入の合計が上限を超えるため追加できませんでした。");
      return;
    }

    // 同時に送信されても加算が失われないよう increment で更新する
    const updatedIncome = await prisma.monthlyIncome.upsert({
      where: {
        userId_yearMonth: { userId: user.id, yearMonth: currentYearMonth },
      },
      update: { amount: { increment: amount } },
      create: {
        userId: user.id,
        yearMonth: currentYearMonth,
        amount,
      },
    });
    const newTotal = updatedIncome.amount;

    const responseMsg = `💰 今月の収入に ¥${amount.toLocaleString()} を追加しました！\n\n今月の総収入: ¥${newTotal.toLocaleString()}`;
    await replyLine(replyToken, responseMsg);
    return;
  }

  // 5. カテゴリの検索 (▼ c: { name: string } 型定義を追加 ▼)
  const category = user.categories.find(
    (c: { name: string }) => c.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!category) {
    await replyLine(
      replyToken,
      `「${categoryName}」は登録されていません。\n${getMessageFormatPrompt(user.categories.map((item) => item.name))}`,
    );
    return;
  }

  // 4. 口座の確認
  let account = user.accounts[0];
  if (!account) {
    account = await prisma.account.create({
      data: { userId: user.id, name: "現金（財布）" },
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
  const remainingDays = getJstRemainingDaysInMonth();

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
      date: monthRange,
    },
  });

  const {
    remainingBudget,
    isCountMode,
    remainingUnits,
    availablePerUnit: dailyAvailable,
  } = calcPocket(category, catBudget, transactions, remainingDays);

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
            date: monthRange,
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