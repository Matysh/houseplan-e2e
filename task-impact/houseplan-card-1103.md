# Влияние Houseplan #1103 на e2e

- Исходная задача: https://github.com/Matysh/houseplan-card/issues/1103
- Дата проверки: 2026-10-29.
- Вердикт: **надо**.
- Причина: новый публичный вход в основной HA custom panel через path/query и новый runtime-переход режима/пространства. Существующие проверки обычной панели не доказывают эти сценарии.
- Выполнение правок тестов: **12 новых cases в трёх отдельных specs и собственном helper реализованы локально; реальное HA исполнение ещё UNVERIFIED**. Syntax, contract lint и Playwright discovery прошли; это не PASS e2e. Финальный exact-beta4 run выполняется перед публикацией.

## Что добавить или изменить перед бетой

Расширить tests/panel.admin.spec.mjs и tests/panel.mobile.spec.mjs:
1. Прямой cold вход /houseplan/kiosk и /houseplan?hpkiosk=1: план виден, собственная шапка/входы редакторов недоступны; oracle шапки отменён решением владельца #1120: outer panel appbar и меню в киоске отсутствуют.
2. /houseplan/kiosk/2 и /houseplan?foreign=keep&hpspace=2&hpkiosk=1 показывают второе пространство в текущем пользовательском порядке. Использовать >=3 пространства с неалфавитными названиями/ID; сверять порядок с обычным UI.
3. Path имеет приоритет целиком при смешении: /houseplan/kiosk/2?hpspace=3&hpkiosk=0 остаётся киоском второго пространства. Чужие query-параметры, encoding и hash не уничтожаются.
4. Без позиции, с 0/текстом/дробью/слишком большим номером доступны все пространства без ошибки. Валидная позиция фиксирует одно: hash, сохранённое пространство и touch-свайп не выводят на другое.
5. SPA-переходы между формами, Back/Forward и выход на корень без флага меняют режим без перезагрузки. При неизменных данных нет повторных config/layout get, setConfig или сброса камеры от чужого query.
6. На мобильном: fixed/all touch-свайпы, pan/pinch/double-tap/локальные размеры, resize/orientation и положительные bounds доступной области согласно #1120, без обрезки/прокрутки документа.
7. Настоящий уход на другую страницу HA завершает редактор; внутренние /kiosk/N не воспринимаются как потеря панели. Disconnect/remount не оставляет старые listeners/действия.

Связать с tests/spaces.admin.spec.mjs:
8. Перестановка пространств другим клиентом переопределяет N по новому порядку; удаление/добавление меняют fixed/all согласно диапазону. При stale cache и задержанном authoritative roster нет кадра с неверным этажом.

Расширить tests/readonly.viewer.spec.mjs и при необходимости существующие editor suites:
9. Read-only/admin киоск не открывает редакторы. Пустой план остаётся без действий создания. Обычные dashboard kiosk/cycle/floor и строгая ошибка старого floor сохраняются.
10. Незавершённый marker/room draft при переходе в киоск: Keep сохраняет ввод и прежний согласованный URL; Discard открывает ровно запрошенный киоск, не сохраняет черновик. Late reply/старое подтверждение не выполняют действие в новом пространстве.

Оракулы: реальные DOM hooks и native input; WS/REST readback для сохранённых данных и прав. Для утверждения об отсутствии лишнего IO считать реальные запросы приложения, не Playwright round trips. Внешние перестановки выполнять через поддерживаемую запись/seed guard с восстановлением исходных config/layout. Перед beta run установить точный принятый source SHA, синхронизировать контракт data-hp и отметить здесь выполненные изменения и результаты.

## Уже проверено внутри продуктовой задачи

Адресные frontend unit/smoke на синтетическом стенде проверяют основной контракт, включая baseline RED → candidate GREEN, Keep/Discard, held-authority cache и native touch. Они не заменяют e2e на настоящем Home Assistant; эта запись не утверждает такой прогон.


## Реализованные journeys, ожидающие реального HA прогона

Отдельные files сохраняют исходные panel.admin/mobile suites и общий контракт:
tests/panel-kiosk.admin.spec.mjs (9cases), .mobile.spec.mjs (1),
.viewer.spec.mjs (2), tests/lib/panel-kiosk-journeys.mjs.
Случаи сопоставлены с исходными пунктами1–10 в названиях. Они проверяют
оба cold entry, порядок трёх различимых этажей, path priority/foreign encoding,
оба вида неверной позиции, native swipe/pinch/pan/doubletap/hold/resize,
SPA/Back/Forward/no extra real IO и сохранение mounted element/camera,
настоящий HA leave/remount, внешнюю перестановку/add/remove, viewer refusal/
empty state, собственный временный Lovelace dashboard с rotation/cycle/floor/
strict invalid floor, Keep/Discard и held real Save ACK после ухода.

Stale-roster случай берёт настоящий browser storageState ДО внешнего изменения
и поднимает отдельный новый browser context с этим старым кэшем. Ответ настоящего
HA config/get удерживается proxy; каждое наблюдённое painted-room множество
сверяется с authoritative floor, пустое ожидание допустимо. Никакого synthetic
HA bus или выдуманного WS response нет. Auth storageState остаётся только
в памяти и не прикладывается к evidence. Все config/layout изменения выполняются
поддержанными authenticated HA WS/API и восстанавливаются полной source-import
парой, включая external_screens namespace/counter; .storage не редактируется.
Временный dashboard удаляется через официальный lovelace/dashboards/delete.

Официальная схема HA2026.10.4 проверена:
[registration](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/lovelace/__init__.py#L278),
[create fields](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/lovelace/const.py#L73),
[config save](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/lovelace/websocket.py#L138),
[collection create/delete](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/helpers/collection.py#L598).

Новую семантику #1103/#1120 без новых hooks ограждает beta4 version gate:
известная публичная beta3 честно SKIP; foreign/unknown HA запускает newest
expectations. SKIP не принимается за PASS. Это не gate поверх новых profilehooks:
четыре #1113 profile journeys принадлежат отдельной companion change.
Перед финальным run root синхронизирует accepted product DOM contract и точный
candidate; локальная syntax/lint/list проверка не утверждает real-HA acceptance.
