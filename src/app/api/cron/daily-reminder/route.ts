import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getTokyoDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type: "year" | "month" | "day") => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Could not determine Tokyo ${type}`);
    return Number(value);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron authentication is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lineAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!lineAccessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
    return NextResponse.json({ error: "LINE notifications are not configured" }, { status: 500 });
  }

  const { year, month, day } = getTokyoDateParts(new Date());
  const dayStart = new Date(Date.UTC(year, month - 1, day) - JST_OFFSET_MS);
  const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { lineId: { not: null } },
    select: { id: true, lineId: true },
  });
  const expenses = users.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: {
          userId: { in: users.map((user) => user.id) },
          type: "EXPENSE",
          date: { gte: dayStart, lt: nextDayStart },
        },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : [];
  const expensesByUserId = new Map(expenses.map((expense) => [expense.userId, expense]));
  const dateLabel = `${year}年${month}月${day}日`;

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    if (!user.lineId) continue;

    const expense = expensesByUserId.get(user.id);
    const message = expense
      ? `【${dateLabel}の支出】\n合計 ¥${(expense._sum.amount ?? 0).toLocaleString()}（${expense._count._all}件）\n入力漏れがないか確認してください。`
      : `【${dateLabel}の支出】\n本日は支出の記録がありません。支出がなかったか、入力忘れがないか確認してください。`;

    try {
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineAccessToken}`,
        },
        body: JSON.stringify({
          to: user.lineId,
          messages: [{ type: "text", text: message }],
        }),
      });

      if (!response.ok) {
        failed += 1;
        console.error("Daily LINE reminder failed:", {
          status: response.status,
          body: (await response.text()).slice(0, 1000),
        });
        continue;
      }

      sent += 1;
    } catch (error: unknown) {
      failed += 1;
      console.error("Daily LINE reminder request failed:", error);
    }
  }

  if (failed > 0) {
    console.error("Daily LINE reminders completed with failures:", { sent, failed });
  }
  return NextResponse.json({
    status: failed > 0 ? "partial" : "success",
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    sent,
    failed,
  });
}
