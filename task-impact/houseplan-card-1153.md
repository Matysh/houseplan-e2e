# houseplan-card#1153 — влияние на HA E2E

Вердикт: **не надо**.

Исходная задача: https://github.com/Matysh/houseplan-card/issues/1153.

Убрана повторная синхронная contentFingerprint(candidate) внутри принятия config/set: приватный accepted-cache helper получает свежий результат того же acceptConfigWrite. Он не берётся из старого staged/pending state или кеша object identity. Каждый последующий accept вычисляет hash заново; глубокие config/layout snapshots, revisions, CAS, rollback, сериализация и история сохраняются. Прочие helper callers и contact/metric invalidation не меняются.

Новых UI/API/схем данных/прав нет, существующие реальные HA Save/ошибка/CAS/Undo/Redo/reload journeys остаются прежними. Нужды в адаптации companion-сценариев из-за #1153 нет. Адресные product tests и native Save/authority/history проверяются в исходной задаче; диагностические WSL CPU/latency серии не выдаются за настоящий HA/GPU или CI PASS. Эта оценка — документация и не запускает HA, тесты или сборку.
