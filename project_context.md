# Stock Analysis Platform — Контекст проекта

## Обзор

Полноценная платформа для технического анализа акций с графиками, индикаторами, сканером рынка и торговыми стратегиями. Данные поступают из Financial Modeling Prep (FMP) API через REST и WebSocket. Система состоит из FastAPI-бэкенда, Next.js-фронтенда, PostgreSQL, Redis и фонового ARQ-воркера. Развёртывание — Docker Compose.

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                              │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │  Frontend   │  │   API      │  │ Worker │  │  DB    │  │ Redis  │ │
│  │  Next.js    │→ │  FastAPI   │→ │  ARQ   │  │ PG 15  │  │  v7    │ │
│  │  :3000      │  │  :8000     │  │        │  │ :5432  │  │ :6379  │ │
│  └────────────┘  └────────────┘  └────────┘  └────────┘  └────────┘ │
│                         │                                            │
│                    FMP API + FMP WebSocket                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Docker-сервисы

| Сервис     | Контейнер                 | Порт | Описание                              |
| ---------- | ------------------------- | ---- | ------------------------------------- |
| `frontend` | `stock_analyzer_frontend` | 3000 | Next.js 14 (App Router)               |
| `api`      | `stock_analyzer_api`      | 8000 | FastAPI + Uvicorn                     |
| `worker`   | `stock_analyzer_worker`   | —    | ARQ фоновый воркер для скрининга      |
| `db`       | `stock_analyzer_db`       | 5432 | PostgreSQL 15                         |
| `redis`    | `stock_analyzer_redis`    | 6379 | Redis 7 (кэш, очередь задач, pub/sub) |

---

## Backend (FastAPI)

### Стек

| Технология         | Версия  | Назначение                     |
| ------------------ | ------- | ------------------------------ |
| FastAPI            | 0.111.0 | REST API фреймворк             |
| Uvicorn            | 0.30.1  | ASGI сервер                    |
| SQLAlchemy         | 2.0.30  | ORM (async via asyncpg)        |
| asyncpg            | 0.29.0  | PostgreSQL async драйвер       |
| Alembic            | 1.13.1  | Миграции БД                    |
| Pydantic           | 2.7.2   | Валидация и сериализация       |
| Redis              | 4.x     | Кэш, pub/sub, очередь ARQ      |
| ARQ                | 0.26.0  | Фоновые задачи (скрининг)      |
| aiohttp            | 3.9.5   | HTTP-клиент для FMP API        |
| websockets         | 14.0+   | FMP WebSocket клиент           |
| pandas + pandas-ta | —       | Расчёт технических индикаторов |

### Структура backend/

```
backend/
├── main.py                    # Точка входа FastAPI, lifespan, CORS
├── Dockerfile
├── requirements.txt
├── core/
│   ├── config.py              # Settings (Pydantic) — все переменные окружения
│   └── database/
│       ├── base.py            # Declarative Base SQLAlchemy
│       └── session.py         # AsyncSession, engine, redis_client
├── api/
│   ├── router.py              # Объединение всех роутеров
│   ├── endpoints/
│   │   ├── charts.py          # GET /charts/{symbol}, GET /charts/quote/{symbol}
│   │   ├── scanner.py         # POST /scanner/scan, GET /scanner/scan/{job_id}
│   │   ├── strategies.py      # CRUD /strategies/
│   │   └── users.py           # POST /users/register, POST /users/login, GET /users/me
│   └── websockets/
│       └── market.py          # WS /ws/market — live тики через Redis pub/sub
├── models/
│   ├── models.py              # SQLAlchemy: User, Strategy
│   └── schemas.py             # Pydantic: UserCreate, StrategyCreate, ScannerParams...
├── services/
│   ├── fmp_client.py          # FMP REST API клиент (OHLCV, quote, SP500)
│   ├── fmp_ws_client.py       # FMP WebSocket клиент (live тики → Redis pub/sub)
│   ├── ws_manager.py          # WebSocket менеджер для фронтенда
│   ├── screener.py            # Логика скрининга акций (pandas-ta)
│   ├── telegram.py            # Telegram уведомления (регистрация, логин)
│   └── telegram_signals.py    # Telegram торговые сигналы
├── workers/
│   ├── main.py                # ARQ WorkerSettings
│   ├── scanner_tasks.py       # background_scan_batch задача
│   └── monitor_cron.py        # Крон мониторинг
└── migrations/                # Alembic миграции
```

### REST API endpoints

| Метод  | Путь                            | Описание                           |
| ------ | ------------------------------- | ---------------------------------- |
| GET    | `/api/v1/charts/{symbol}`       | OHLCV данные (timeframe, from, to) |
| GET    | `/api/v1/charts/quote/{symbol}` | Реалтайм котировка                 |
| POST   | `/api/v1/scanner/scan`          | Запуск фонового скрининга          |
| GET    | `/api/v1/scanner/scan/{id}`     | Прогресс скрининга                 |
| GET    | `/api/v1/strategies/`           | Список стратегий пользователя      |
| POST   | `/api/v1/strategies/`           | Создать стратегию                  |
| PATCH  | `/api/v1/strategies/{id}`       | Обновить стратегию                 |
| DELETE | `/api/v1/strategies/{id}`       | Удалить стратегию                  |
| POST   | `/api/v1/users/register`        | Регистрация                        |
| POST   | `/api/v1/users/login`           | Логин → токен                      |
| GET    | `/api/v1/users/me`              | Профиль по токену                  |
| WS     | `/api/v1/ws/market`             | Live тики (Redis pub/sub)          |
| GET    | `/health`                       | Healthcheck                        |

### Модели БД

**User** (`users`)

- `id` (PK), `email` (unique), `hashed_password`, `is_active`, `created_at`

**Strategy** (`strategies`)

- `id` (PK), `user_id`, `name`, `description`, `indicators` (JSON), `created_at`

### Внешние API

- **FMP REST API** (`https://financialmodelingprep.com/stable`) — исторические данные, котировки, SP500 список
- **FMP WebSocket** — live тики по подписке на тикеры
- **Telegram Bot API** — уведомления о регистрации/логине и торговые сигналы

---

## Frontend (Next.js)

### Стек

| Технология            | Версия | Назначение                          |
| --------------------- | ------ | ----------------------------------- |
| Next.js               | 14.2.5 | React фреймворк (App Router)        |
| React                 | 18.3.1 | UI библиотека                       |
| TypeScript            | 5.9.3  | Типизация                           |
| lightweight-charts    | 4.2.0  | Графики свечей (TradingView engine) |
| @tanstack/react-query | 5.51.1 | Кэширование данных / мутации        |
| zustand               | 4.5.4  | Глобальный стейт                    |
| react-hook-form       | 7.52.1 | Формы (логин, регистрация)          |

### Структура frontend/

```
frontend/
├── app/
│   ├── layout.tsx                 # Root layout + providers
│   ├── page.tsx                   # Redirect → /chart/AAPL
│   ├── globals.css                # CSS переменные, тема
│   ├── chart/[symbol]/page.tsx    # 📊 Основная страница графика
│   ├── multichart/page.tsx        # Мульти-график
│   ├── scanner/page.tsx           # Сканер рынка
│   ├── strategies/page.tsx        # Управление стратегиями
│   └── login/page.tsx             # Авторизация / регистрация
├── components/
│   ├── Chart/
│   │   ├── StockChart.tsx         # Основной компонент графика (lightweight-charts)
│   │   ├── StockChart.module.css
│   │   ├── ChartToolbar.tsx       # Тулбар: тикер, таймфрейм, пресеты, индикаторы
│   │   ├── ChartToolbar.module.css
│   │   ├── DrawingCanvas.tsx      # Canvas overlay для инструментов рисования
│   │   ├── DrawingToolbar.tsx     # Тулбар рисования (курсор, линии, линейка, SL/TP, кисть)
│   │   ├── DrawingToolbar.module.css
│   │   ├── DrawingTools.types.ts  # TypeScript типы для рисования
│   │   ├── IndicatorsModal.tsx    # Модальное окно выбора индикаторов (с описаниями)
│   │   ├── IndicatorsModal.module.css
│   │   ├── IndicatorSettingsModal.tsx # Настройки конкретного индикатора
│   │   ├── IndicatorSettings.module.css
│   │   └── CandleChart.tsx        # Legacy wrapper
│   ├── layout/
│   │   ├── Header.tsx             # Навигация
│   │   └── Header.module.css
│   └── providers/
│       └── QueryProvider.tsx      # React Query provider
├── hooks/
│   ├── useAuth.ts                 # Хук авторизации
│   └── useMarketWebsocket.ts     # WebSocket хук для live тиков
├── lib/
│   └── api.ts                     # API клиент (authApi, strategiesApi, scannerApi, chartsApi)
├── store/
│   └── ...                        # Zustand сторы
├── types/
│   └── index.ts                   # TypeScript типы (User, Strategy, OHLCVBar, etc.)
└── utils/
    └── indicators.ts              # Расчёт индикаторов (SMA, EMA, RSI, ADX, HHLL, ATR)
```

### Страницы

| Путь              | Описание                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `/chart/[symbol]` | Главная — интерактивный график с индикаторами, рисованием, пресетами |
| `/multichart`     | Мульти-график (несколько тикеров)                                    |
| `/scanner`        | Сканер акций с фильтрами по индикаторам                              |
| `/strategies`     | CRUD стратегий                                                       |
| `/login`          | Авторизация + регистрация                                            |

### Индикаторы

Реализованные технические индикаторы (расчёт на фронтенде в `utils/indicators.ts`):

| Индикатор | Описание                              | Размещение   |
| --------- | ------------------------------------- | ------------ |
| SMA       | Простая скользящая средняя            | Main pane    |
| EMA       | Экспоненциальная скользящая средняя   | Main pane    |
| RSI       | Индекс относительной силы             | Extra pane 1 |
| ADX       | Средний направленный индекс (+DI/-DI) | Extra pane 2 |
| HHLL      | Highest High / Lowest Low             | Main pane    |
| ATR       | Средний истинный диапазон             | Extra pane   |

Все индикаторы поддерживают:

- Настройку периода, цвета, толщины линии
- Цепочки (индикатор на основе другого индикатора, например SMA(RSI))
- Сглаживание ATR: RMA, SMA, EMA, WMA

### Инструменты рисования

| Инструмент | Описание                                                  |
| ---------- | --------------------------------------------------------- |
| Cursor     | Режим курсора (клик — удалить, зажать якорь — перетащить) |
| HLine      | Горизонтальная линия по цене                              |
| TrendLine  | Трендовая линия (2 точки)                                 |
| Ruler      | Линейка (измерение цены/процентов)                        |
| SL/TP      | Стоп-Лосс / Тейк-Профит (3 клика: entry, TP, SL)          |
| Brush      | Кисточка (свободное рисование)                            |

---

## Потоки данных

### Получение OHLCV данных

```
Frontend → GET /api/v1/charts/{symbol}?timeframe=1day
         → API → FMP REST API → format → lightweight-charts
```

### Live тики (WebSocket)

```
FMP WebSocket → fmp_ws_client → Redis pub/sub → ws_manager → Frontend WS
```

### Скрининг акций

```
Frontend → POST /api/v1/scanner/scan → ARQ queue → Worker (background_scan_batch)
         → Redis progress → Frontend polling GET /scanner/scan/{job_id}
```

### Пресеты (стратегии)

```
Frontend → GET/POST/PATCH/DELETE /api/v1/strategies/ → PostgreSQL (strategies table)
```

---

## Аутентификация

Текущая реализация — упрощённая (dev):

- Регистрация и логин требуют `admin_password = "admin"`
- Токен = `sha256(email + TEAM_PASSWORD)`
- Хранение токена в `localStorage`
- **TODO**: заменить на JWT + OAuth в production

---

## Команды разработки

```bash
# Запуск всего стека
docker compose up --build

# Только фронтенд (dev)
cd frontend && npm run dev

# Только бэкенд (dev)
cd backend && uvicorn main:app --reload

# Пересборка
docker compose down && docker compose up --build

# Билд фронтенда
cd frontend && npx next build
```
