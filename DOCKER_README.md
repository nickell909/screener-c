# Docker-развертывание Next.js приложения

## Обзор проекта

Это Next.js приложение с использованием:
- **Фреймворк**: Next.js 16 с TypeScript
- **Runtime**: Bun (быстрая альтернатива Node.js)
- **База данных**: SQLite с Prisma ORM
- **Стили**: Tailwind CSS 4 + shadcn/ui компоненты
- **Reverse Proxy**: Caddy (опционально)

Проект представляет собой платформу для анализа финансовых инструментов, включая синтетические инструменты и спреды.

---

## Структура Docker файлов

### 1. `Dockerfile` - Мультистейдж сборка

Использует трёхэтапную сборку для минимизации размера финального образа:

```dockerfile
# Этап 1: deps - Установка зависимостей
FROM oven/bun:1 AS deps

# Этап 2: builder - Сборка приложения  
FROM oven/bun:1 AS builder

# Этап 3: runner - Production образ
FROM oven/bun:1-slim AS runner
```

**Преимущества:**
- Минимальный размер финального образа (~150MB)
- Безопасность (запуск от непривилегированного пользователя)
- Оптимизированная кэш-слойность

### 2. `docker-compose.yml` - Оркестрация сервисов

Включает:
- **app**: Основное Next.js приложение
- **caddy**: Reverse proxy (опциональный профиль)
- **volumes**: Постоянное хранилище для БД и логов
- **networks**: Изолированная сеть
- **healthcheck**: Мониторинг здоровья приложения

### 3. `.dockerignore` - Исключения из сборки

Исключает ненужные файлы для уменьшения размера образа и ускорения сборки.

---

## Быстрый старт

### Предварительные требования

- Docker версии 20.10+
- Docker Compose версии 2.0+
- 2GB свободной памяти
- Порты 3000 (или 80/443 с Caddy)

### Вариант 1: Запуск только приложения

```bash
# Сборка и запуск
docker compose up --build

# Или в фоновом режиме
docker compose up -d --build
```

Приложение будет доступно по адресу: http://localhost:3000

### Вариант 2: Запуск с Caddy proxy

```bash
# Запуск с профилем reverse proxy
docker compose --profile with-proxy up -d --build
```

Приложение будет доступно через Caddy на портах 80/443.

### Вариант 3: Использование Docker напрямую

```bash
# Сборка образа
docker build -t nextjs-app .

# Запуск контейнера
docker run -d \
  --name nextjs-app \
  -p 3000:3000 \
  -e DATABASE_URL=file:/app/db/custom.db \
  -v nextjs-db-data:/app/db \
  nextjs-app
```

---

## Управление приложением

### Просмотр логов

```bash
# Логи приложения
docker compose logs -f app

# Логи Caddy
docker compose logs -f caddy

# Все логи вместе
docker compose logs -f
```

### Остановка приложения

```bash
# Остановить сервисы
docker compose down

# Остановить и удалить volumes (внимание: удалит базу данных!)
docker compose down -v
```

### Перезапуск

```bash
# Обычный перезапуск
docker compose restart

# Пересборка и перезапуск
docker compose up -d --build --force-recreate
```

### Обновление приложения

```bash
# Актуализировать образ и пересобрать
docker compose pull
docker compose up -d --build
```

---

## Работа с базой данных

### Инициализация базы данных

При первом запуске база данных автоматически создаётся. Для применения миграций:

```bash
# Выполнить миграции внутри контейнера
docker compose exec app bun run db:migrate

# Или push схемы (без миграций)
docker compose exec app bun run db:push
```

### Резервное копирование

```bash
# Создать бэкап базы данных
docker compose exec app cp /app/db/custom.db /tmp/backup-$(date +%Y%m%d).db
docker compose cp app:/tmp/backup-$(date +%Y%m%d).db ./backups/

# Восстановление из бэкапа
docker compose cp ./backups/backup-20250101.db app:/app/db/custom.db
docker compose restart app
```

### Доступ к SQLite консоли

```bash
# Подключение к SQLite внутри контейнера
docker compose exec app sqlite3 /app/db/custom.db
```

---

## Переменные окружения

### Основные переменные

| Переменная | Значение по умолчанию | Описание |
|-----------|---------------------|----------|
| `NODE_ENV` | `production` | Режим работы (production/development) |
| `PORT` | `3000` | Порт приложения |
| `DATABASE_URL` | `file:/app/db/custom.db` | Путь к SQLite базе |

### Создание .env файла

```bash
# Создайте файл .env в корне проекта
cat > .env << EOF
DATABASE_URL=file:/app/db/custom.db
NODE_ENV=production
PORT=3000
EOF
```

**Важно**: Файл `.env` не включается в Docker образ по соображениям безопасности. Используйте docker-compose override или secrets для production.

---

## Production развертывание

### Рекомендации для production

1. **Используйте внешнее хранилище для БД**
   ```yaml
   volumes:
     - /path/to/host/db:/app/db
   ```

2. **Настройте ограничения ресурсов**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
       reservations:
         cpus: '1'
         memory: 1G
   ```

3. **Используйте Docker secrets для чувствительных данных**

4. **Настройте мониторинг и логирование**
   - Prometheus + Grafana для метрик
   - ELK стек или Loki для логов

5. **Обновите Caddyfile для production домена**
   ```
   your-domain.com {
       reverse_proxy app:3000
   }
   ```

### Развертывание на сервере

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd project

# 2. Настройте переменные окружения
cp .env.example .env
nano .env

# 3. Запустите в production режиме
docker compose --profile with-proxy up -d --build

# 4. Проверьте статус
docker compose ps

# 5. Проверьте логи
docker compose logs -f
```

---

## Troubleshooting

### Приложение не запускается

```bash
# Проверьте логи
docker compose logs app

# Проверьте здоровье контейнера
docker compose ps

# Попробуйте пересобрать без кэша
docker compose build --no-cache
docker compose up -d
```

### Ошибки базы данных

```bash
# Сбросьте базу данных (внимание: все данные будут удалены!)
docker compose exec app bun run db:reset

# Проверьте права доступа к volume
docker volume inspect nextjs-db-data
```

### Проблемы с портами

```bash
# Проверьте какие порты заняты
netstat -tlnp | grep 3000

# Измените порт в docker-compose.yml
ports:
  - "3001:3000"  # Используйте другой внешний порт
```

### Нехватка памяти

```bash
# Увеличьте лимиты в docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G
```

---

## Мониторинг и метрики

### Проверка статуса

```bash
# Статус всех сервисов
docker compose ps

# Использование ресурсов
docker stats nextjs-app

# Информация о контейнере
docker inspect nextjs-app
```

### Health check

Приложение настроено с health check:
- Интервал: 30 секунд
- Таймаут: 10 секунд
- Попыток: 3
- Период запуска: 40 секунд

Проверка выполняется через API endpoint `/api`.

---

## Безопасность

### Реализованные меры

1. ✅ Запуск от непривилегированного пользователя (`nextjs:nodejs`)
2. ✅ Использование slim образов для минимизации поверхности атаки
3. ✅ Исключение `.env` файлов из образа
4. ✅ Read-only mount для Caddyfile
5. ✅ Health checks для мониторинга

### Дополнительные рекомендации

- Регулярно обновляйте базовые образы
- Используйте Docker Content Trust
- Сканируйте образы на уязвимости:
  ```bash
  docker scan nextjs-app
  ```
- Настройте firewall для ограничения доступа к портам

---

## Разработка с Docker

### Development режим

Для разработки создайте отдельный `docker-compose.dev.yml`:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: bun run dev
```

### Hot reload

При использовании development режима изменения в коде автоматически применяются без пересборки образа.

---

## CI/CD интеграция

### GitHub Actions пример

```yaml
name: Deploy to Docker

on:
  push:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          docker tag myapp:${{ github.sha }} registry.com/myapp:latest
          docker push registry.com/myapp:latest
```

---

## Архитектура

```
┌─────────────────┐
│     Caddy       │ :80/:443
│  (optional)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Next.js App   │ :3000
│     (Bun)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SQLite DB     │ Volume
│   (Prisma)      │
└─────────────────┘
```

---

## Полезные команды

```bash
# Очистка старых образов
docker image prune -a

# Очистка неиспользуемых volumes
docker volume prune

# Просмотр использования дискового пространства
docker system df

# Экспорт образа
docker save -o nextjs-app.tar nextjs-app:latest

# Импорт образа
docker load -i nextjs-app.tar
```

---

## Поддержка и контакты

- Документация Next.js: https://nextjs.org/docs
- Документация Bun: https://bun.sh/docs
- Документация Prisma: https://www.prisma.io/docs
- Документация Docker: https://docs.docker.com

---

## Лицензия

Этот проект распространяется под той же лицензией, что и основной код приложения.
