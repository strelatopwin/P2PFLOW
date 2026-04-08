# Crypto Exchange Screener

Проєкт на Next.js з:
- live інтеграцією до ProfitArbitrage API,
- email-only auth (без реєстрації/паролю),
- access-control через Drizzle + Postgres,
- Telegram нотифікаціями для approve/reject доступу.

## 1) Встановлення

```bash
npm install
```

## 2) Налаштування `.env`

Скопіюй `.env.example` в `.env` і заповни значення:

```bash
cp .env.example .env
```

Обов'язкові змінні:

- `DATABASE_URL`
- `APP_BASE_URL` (локально зазвичай `http://localhost:3000`)
- `ACCESS_APPROVAL_SECRET` (секрет для approve endpoint)
- `AUTH_SESSION_SECRET` (секрет підпису auth cookie)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PROFIT_ARBITRAGE_LOGIN`
- `PROFIT_ARBITRAGE_PASSWORD`

Опційні:

- `PROFIT_ARBITRAGE_FID` (default: `profitarbitrage`)
- `PROFIT_ARBITRAGE_MIN_REQUEST_INTERVAL_MS` (default: `5000`)
- `PROFIT_ARBITRAGE_BUY_EXCHANGES`
- `PROFIT_ARBITRAGE_SELL_EXCHANGES`

## 3) Підняти схему БД (Drizzle)

Для локального старту достатньо:

```bash
npm run db:push
```

Якщо хочеш згенерувати міграції:

```bash
npm run db:generate
npm run db:push
```

## 4) Запуск

```bash
npm run dev
```

Далі відкрий [http://localhost:3000](http://localhost:3000).

## 5) Як працює флоу доступу

1. Користувач вводить email на `/login` (без паролю).
2. Система створює/оновлює заявку доступу в `access_requests` з `approved=false`.
3. В Telegram адміну відправляється повідомлення з approve URL.
4. До approve сторінка таблиці недоступна, користувач бачить `/waiting-access`.
5. Після approve користувач отримує доступ до `/` та `/api/market`.

## 6) Endpoints

- `POST /api/auth/login` - email request, ставить signed auth cookie.
- `POST /api/auth/logout` - вихід, очищає cookies.
- `GET /api/access/status` - поточний статус доступу для залогіненого юзера.
- `GET /api/access/approve?userId=...&secret=...&action=approve|reject` - адміністраторський approve/reject.
- `GET /api/market` - дані таблиці (доступно лише для авторизованих і approved).

## 7) Перевірка

```bash
npm run lint
```

## 8) Міграція (remove `status`)

Якщо таблиця вже була створена раніше з колонкою `status`, застосуй SQL:

```sql
ALTER TABLE "access_requests"
DROP COLUMN IF EXISTS "status";
```

Готовий файл: `drizzle/0001_drop_status_from_access_requests.sql`

## 9) Troubleshooting

- `401` на `/api/market` - немає валідної auth cookie (не залогінений).
- `403` на `/api/market` - юзер не approved.
- `500` на login/status/market - перевір `DATABASE_URL`, `AUTH_SESSION_SECRET`, `PROFIT_ARBITRAGE_*`.
- Не приходить Telegram - перевір `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, і що бот має право писати в чат.
