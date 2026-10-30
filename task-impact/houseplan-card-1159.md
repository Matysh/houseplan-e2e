# Task impact #1159

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1159.
Дата проверки: 2026-10-30. Материал задачи: 967052cbfa0c9ac2bef64ed35c5d6ff1b360c0ce.

Уже полный steady-кадр пропускает ненужное измерение stage в settle callback.
Холодный старт, переходные состояния, положительная геометрия, asset/token/paint
guards, HA transport, сохранение и разрешённые действия не меняются.
Матрица фактического compiled host-method и проверки представленных кадров
принадлежат продуктовым unit/smoke/continuity наборам, а не второму контуру HA.

Существующие `tests/panel.admin.spec.mjs`,
`tests/selective-invalidation.admin.spec.mjs`, `tests/zz-restart.admin.spec.mjs`
и upgrade покрывают первый вход, возврат, переход к обновлённому этажу,
восстановление связи и обновление установленного пакета. Нового шва с HA нет;
дополнительных сценариев E2E по этой задаче не требуется.

Этот вердикт не заменяет обязательную полную матрицу journeys/first-run/upgrade
на окончательном release-кандидате и не доказывает performance-бюджеты.
