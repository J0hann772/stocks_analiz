# Переменные проекта Stock Analysis Platform

## Файл .env (корень проекта)

Основной файл с секретами. Используется docker-compose и backend (через pydantic-settings).

```env
# Financial Modeling Prep API
FMP_API_KEY=<your_fmp_api_key>

# Telegram Bot (уведомления о регистрации/логине)
TG_BOT_TOKEN=<your_telegram_bot_token>
TG_CHAT_ID=<your_telegram_chat_id>

# Telegram Signal Bot (торговые сигналы)
TG_SIGNAL_BOT_TOKEN=<your_signal_bot_token>

# Пароль команды для регистрации (admin_password)
TEAM_PASSWORD=admin
```

---

## Все переменные окружения

### Backend (API + Worker)

Определены в `backend/core/config.py` (Pydantic `BaseSettings`), в docker-compose передаются контейнерам.

#### FMP API

| Переменная     | Значение по умолчанию                      | Описание                         |
| -------------- | ------------------------------------------ | -------------------------------- |
| `FMP_API_KEY`  | `""`                                       | API ключ Financial Modeling Prep |
| `FMP_BASE_URL` | `https://financialmodelingprep.com/stable` | Базовый URL FMP API (stable)     |

> **Важно**: `FMP_API_KEY` обязателен для работы графиков, котировок и сканера.

#### PostgreSQL

| Переменная          | Значение по умолчанию | Описание               |
| ------------------- | --------------------- | ---------------------- |
| `POSTGRES_USER`     | `postgres`            | Имя пользователя БД    |
| `POSTGRES_PASSWORD` | `postgres`            | Пароль БД              |
| `POSTGRES_DB`       | `stock_analyzer`      | Имя базы данных        |
| `POSTGRES_HOST`     | `localhost` / `db`    | Хост (в Docker → `db`) |
| `POSTGRES_PORT`     | `5432`                | Порт PostgreSQL        |

> Внутри Docker хост = `db` (имя сервиса). Локально = `localhost`.

#### Redis

| Переменная  | Значение по умолчанию    | Описание                          |
| ----------- | ------------------------ | --------------------------------- |
| `REDIS_URL` | `redis://localhost:6379` | URL Redis (кэш, очередь, pub/sub) |

> Внутри Docker = `redis://redis:6379`.

#### Аутентификация

| Переменная      | Значение по умолчанию | Описание                           |
| --------------- | --------------------- | ---------------------------------- |
| `TEAM_PASSWORD` | `supersecret`         | Пароль для генерации токенов (dev) |

> В `.env` = `admin`, в docker-compose = `supersecret`. **Docker значение перезаписывает .env.**
> Используется для: регистрации (`admin_password`), генерации bearer-токенов (`sha256(email:TEAM_PASSWORD)`).

#### Telegram

| Переменная            | Значение | Описание                         |
| --------------------- | -------- | -------------------------------- |
| `TG_BOT_TOKEN`        | `""`     | Токен бота для уведомлений       |
| `TG_CHAT_ID`          | `""`     | ID чата для уведомлений          |
| `TG_SIGNAL_BOT_TOKEN` | `""`     | Токен бота для торговых сигналов |

#### Timezone

| Переменная | Значение        | Описание                 |
| ---------- | --------------- | ------------------------ |
| `TZ`       | `Europe/Moscow` | Часовой пояс контейнеров |

---

### Frontend (Next.js)

| Переменная            | Значение                | Описание                          |
| --------------------- | ----------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL бэкенда (доступна в браузере) |

> Устанавливается в docker-compose для сервиса `frontend`.
> В коде: `lib/api.ts` → `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`

---

## Hardcoded значения (TODO: вынести в конфиг)

| Файл                    | Значение              | Описание                     | Рекомендация                 |
| ----------------------- | --------------------- | ---------------------------- | ---------------------------- |
| `frontend/.../page.tsx` | `USER_ID = 1`         | ID пользователя для пресетов | Получать из auth context     |
| `backend/.../users.py`  | `"admin"`             | admin_password проверка      | Использовать `TEAM_PASSWORD` |
| `backend/.../config.py` | `"supersecret"`       | TEAM_PASSWORD default        | Задавать через .env          |
| `backend/main.py`       | `allow_origins=["*"]` | CORS (все домены)            | Ограничить в production      |

---

## Docker Compose порты

| Сервис   | Внутренний | Внешний | Описание                |
| -------- | ---------- | ------- | ----------------------- |
| frontend | 3000       | 3000    | Next.js UI              |
| api      | 8000       | 8000    | FastAPI REST + WS       |
| db       | 5432       | 5432    | PostgreSQL              |
| redis    | 6379       | —       | Redis (только internal) |

---

## Docker Volumes

| Volume          | Контейнер   | Путь                       |
| --------------- | ----------- | -------------------------- |
| `postgres_data` | db          | `/var/lib/postgresql/data` |
| `redis_data`    | redis       | `/data`                    |
| `./backend`     | api, worker | `/app` (bind mount, dev)   |

---

## Получение файла .env

Для работы проекта необходимо создать `.env` файл в корне с минимальным содержимым:

```env
FMP_API_KEY=<получить на https://financialmodelingprep.com>
TG_BOT_TOKEN=<создать бота через @BotFather>
TG_CHAT_ID=<ID чата/канала>
TEAM_PASSWORD=admin
TG_SIGNAL_BOT_TOKEN=<опционально>
```

Без `FMP_API_KEY` графики и сканер не будут работать.
