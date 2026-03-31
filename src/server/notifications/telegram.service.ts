type TelegramLoginRequest = {
  email: string;
  userId: string;
};

function buildApproveLink(userId: string): string {
  const baseUrl = process.env.APP_BASE_URL;
  const secret = process.env.ACCESS_APPROVAL_SECRET;

  if (!baseUrl || !secret) {
    return "";
  }

  const params = new URLSearchParams({ userId, secret });
  return `${baseUrl.replace(/\/$/, "")}/api/access/approve?${params.toString()}`;
}

export async function sendTelegramLoginRequestNotification(
  payload: TelegramLoginRequest
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return;
  }

  const approveLink = buildApproveLink(payload.userId);
  const lines = [
    "Новий запит на доступ",
    `Email: ${payload.email}`,
    `ID користувача: ${payload.userId}`,
    approveLink ? `Схвалити: ${approveLink}` : "",
  ].filter(Boolean);

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });
}
