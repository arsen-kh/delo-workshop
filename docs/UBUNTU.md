# Запуск на Ubuntu: Node.js + Nginx

Для этой версии нужны Node.js 22.13+ (рекомендуется актуальная Node.js 22 LTS либо 24 LTS), Nginx и домен. Установка Node.js зависит от текущего окружения сервера; сначала проверьте `node --version` и `command -v node`.

`workshop-server.tar.gz` содержит готовую сборку. Для запуска не требуется устанавливать npm-зависимости. SQLite входит в Node.js. Каталог `server-dist` должен сохраняться целиком, включая `public` и `migrations`.

## 1. Разместить файлы

Загрузите архив в свой домашний каталог сервера. Дальнейшие команды выполняются на сервере. Они создают отдельный системный аккаунт и каталоги приложения; существующий сайт не заменяется.

```sh
sudo useradd --system --home /opt/workshop --shell /usr/sbin/nologin workshop
sudo install -d -o root -g root /opt/workshop
sudo install -d -o workshop -g workshop -m 700 /var/lib/workshop
sudo tar -xzf ~/workshop-server.tar.gz -C /opt/workshop
```

Если пользователь `workshop` уже существует, повторно его создавать не нужно. При обновлении сначала сохраните копию старой сборки и базы; заменяйте файлы приложения, не каталог данных.

## 2. Создать настройки входа

```sh
cd /opt/workshop
sudo node deploy/make-env.mjs /etc/workshop.env
```

Команда создаст новый файл настроек и покажет случайный пароль. Сохраните его в менеджере паролей. Она не перезаписывает существующий файл. Секреты не входят в архив.

Логин по умолчанию — `arsen`. Порт — 3000. База — `/var/lib/workshop/workshop.sqlite`. Приложение слушает только `127.0.0.1`; наружу его открывает Nginx.

## 3. Запустить службу

В `deploy/workshop.service` указан `/usr/bin/node`. Если `command -v node` показывает другой системный путь, укажите его в `ExecStart`. Node.js в личном каталоге через nvm может быть недоступен системному пользователю — предпочтителен системный бинарник.

```sh
sudo cp /opt/workshop/deploy/workshop.service /etc/systemd/system/workshop.service
sudo systemctl daemon-reload
sudo systemctl enable --now workshop
sudo systemctl status workshop --no-pager
curl http://127.0.0.1:3000/health
```

Ожидаемый ответ проверки: `{"ok":true}`. Таблицы создаются при старте по версиям миграций, в HTTP-обработчиках схема не меняется.

## 4. Подключить домен

Скопируйте `deploy/nginx.conf` в отдельный файл сайта, замените `workshop.example.com` на свой домен. DNS-запись домена должна указывать на сервер.

```sh
sudo cp /opt/workshop/deploy/nginx.conf /etc/nginx/sites-available/workshop
sudo nano /etc/nginx/sites-available/workshop
sudo ln -s /etc/nginx/sites-available/workshop /etc/nginx/sites-enabled/workshop
sudo nginx -t
sudo systemctl reload nginx
```

Если ссылка уже существует, не создавайте её снова. Не меняйте конфигурацию действующего сайта без проверки конфликтов доменов и портов.

Подключите HTTPS привычным способом. Если используете Certbot с модулем Nginx:

```sh
sudo certbot --nginx -d ваш-домен
```

Настройка сертификата зависит от установленного на сервере ПО. По HTTP не вводите реальные контакты и постоянный пароль. После подключения HTTPS cookie получает атрибут `Secure` благодаря `X-Forwarded-Proto` от Nginx.

## 5. Проверить после запуска

1. Открыть домен по HTTPS и войти.
2. Нажать «Добавить примеры» или «Попробовать на примерах».
3. Создать заявку, перезагрузить страницу и убедиться, что она осталась.
4. Изменить статус, открыть историю, скачать отчёт.
5. Перезапустить `workshop` и проверить сохранность данных.

Логи: `sudo journalctl -u workshop -n 100 --no-pager`.

## Резервная копия

В архиве есть скрипт создания согласованной копии SQLite, включая данные, ещё находящиеся в WAL. Не копируйте только основной файл живой базы вручную.

```sh
sudo -u workshop env DB_PATH=/var/lib/workshop/workshop.sqlite \
  /usr/bin/node /opt/workshop/scripts/backup.mjs \
  /var/lib/workshop/backup-2026-11-07.sqlite
```

Имя копии должно быть новым. Для восстановления остановите службу, сохраните текущую базу и связанные файлы `-wal`/`-shm`, затем восстановите согласованную копию в чистый каталог данных с владельцем `workshop`. Не смешивайте восстановленную базу со старыми WAL-файлами. Сначала отрепетируйте восстановление на тестовой копии.

## Вариант с Docker

В исходном архиве есть `Dockerfile` и `compose.yaml`. В корне создайте `.env` со значениями `ADMIN_USER`, `ADMIN_PASSWORD` (от 12 символов), `SESSION_SECRET` (от 32 символов), затем выполните `docker compose up -d --build`. Порт контейнера опубликован только на `127.0.0.1:3000`; Nginx настраивается так же. Данные сохраняются в именованном томе `workshop-data`. Docker-запуск в текущем окружении не проверялся.
