# houseplan-e2e

Честные браузерные тесты [House Plan](https://github.com/Matysh/houseplan-card)
на **реальном Home Assistant**: контейнер HA, интеграция из того самого
`houseplan.zip`, который скачивает HACS, два настоящих пользователя, настоящий
браузер. Здесь проверяются швы, которых не видит харнес продукта (заглушка
`hass`, статическая страница): порядок монтирования панели HA, дашборды
sections/masonry/panel, роли пользователей, путь обновления, HA-версии.

Логика продукта здесь **не** дублируется — она покрыта юнитами, смоками,
golden и мутантами в репозитории продукта. Тут — 15–20 пользовательских
путешествий, не вторая пирамида.

## Как устроено

| что | где |
|---|---|
| Конфиг HA, с которого стартует прогон | `seed/` — производная от публичного демо-стенда (анонимизированный реальный дом: план, области, устройства на template-сущностях, дашборды). `custom_components/houseplan` в seed **нет** — она ставится на каждый прогон |
| Пользователи | `scripts/users.mjs`: `demo` (админ) и `viewer` (не админ); хэши паролей пишет `prepare-seed` в run-каталог, в репозитории их нет |
| Установка House Plan | `scripts/install-houseplan.mjs --ref=latest\|stable\|<тег>\|<ветка>\|<путь>` — релизы из asset `houseplan.zip`, ветки — снапшот (бандл закоммичен) |
| HA | `scripts/ha.mjs up\|wait\|logs\|down` — `ghcr.io/home-assistant/home-assistant:<tag>`, порт только на loopback; `wait` ждёт не «ядро поднялось», а «интеграция отдала бандл» |
| Тесты | `tests/*.spec.mjs`, Playwright; логин через настоящую страницу входа один раз (`auth.setup.mjs`), дальше — сохранённое состояние браузера |
| Оракулы | состояние — HA REST (`tests/lib/ha-api.mjs`), DOM — только объявленные хуки `data-hp` / `data-editor-navigation` (STYLING-HOOKS.md продукта; расширение контракта — houseplan-card#489) |

Проекты Playwright: `admin`, `viewer`, `mobile` (Pixel 7). Прогон последовательный:
один HA, одно состояние.

## Запуск локально

```sh
npm ci && npx playwright install chromium
npm run seed                                  # seed → run/
node scripts/install-houseplan.mjs --ref=latest --out=run
npm run ha:up -- --version=stable --dir="$PWD/run"
npm run ha:wait
npm test
npm run ha:down
```

`HA_URL` перенаправляет тесты на любой другой инстанс (например, стенд), но
тогда пользователи и seed — ваша забота.

## CI

`.github/workflows/e2e.yml`: по кнопке (`houseplan_ref`, `ha_version`), ночью
(свежая бета на stable HA) и при пуше в `main` этого репозитория. Артефакты:
отчёт Playwright, трейсы/видео упавших сценариев, `home-assistant.log`,
`docker.log`. При наличии секретов `TG_BOT_TOKEN`/`TG_CHAT_ID` красный прогон
уходит в Telegram.

Роль в процессе продукта: сначала наблюдательный режим; затем зелёный прогон
на кандидате — критерий стабильного промоушена (stable = promotion-only), не
гейт на каждый мерж.

## Что дальше

- первый запуск на пустом HA: onboarding → пространство → комната → устройство;
- путь обновления беты N → N+1 без сброса кэша (класс «configuration error»);
- переподключение после рестарта HA;
- PDF-экспорт: файл скачивается и открывается;
- матрица версий HA: минимальная поддерживаемая, stable, месячная бета;
- реальный апдейт через HACS на демо-стенде (нужен его GitHub-токен).
