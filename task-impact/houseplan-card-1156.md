# houseplan-card#1156 — влияние на HA E2E

Вердикт: **надо**, адаптация перед следующей бетой.

Исходная задача: https://github.com/Matysh/houseplan-card/issues/1156.

В диалог копирования добавлены независимые опции мебели и декора; обе по умолчанию выключены при каждом новом открытии. Мебель — только `space.decor[].kind === 'furniture'`, прочие decor (линии, фигуры, текст, images) — вторая категория. Устройства остаются markers и не копируются. Persisted schema и существующая Optimize/config-set политика не меняются.

## Изменения перед бетой

- Сохранить существующий `tests/space-copy-lifecycle.admin.spec.mjs`: он доказывает retired HA settings shell → copy dialog → Cancel без записи; добавленные checkbox не должны нарушать этот путь. Добавить в него/соседний admin case initial-off, смену выбора Tab/Space, Cancel/Escape → settings и сброс после нового открытия.
- Добавить реальный authenticated copy/write/reload путь на синтетическом пространстве с мебелью, фигурой/линией/текстом и custom-image asset. Проверить все четыре сочетания. Селекторы: `[data-hp="field"][data-field="space-copy-furniture"]` и `[data-hp="field"][data-field="space-copy-decor"]`; подтверждение существующим `button.btn[data-hp="dialog-confirm"]` внутри space dialog.
- После каждого создания читать настоящий config/get и после reload: ожидаемый набор decor, порядок/поля/asset/text references, свежие уникальные ID; источник и markers/layout не лишаются объектов. Без галочек decor в новой копии отсутствует. После Copy активна новая копия, поэтому перед следующим случаем штатно вернуться на исходное пространство.
- Сохранить прежние проверки физической геометрии и ownership: комнаты не переносятся, стены комнат преобразуются в partitions, host проёмов переназначается, contact/lock не копируются. Сценарий требуемой Optimize/отмены сохраняет обе опции; error/retry не теряет выбор.

Статус адаптации: **реализована перед beta.2**: новый authenticated browser journey в tests/space-copy-lifecycle.admin.spec.mjs готовит furniture/image/line настоящим редактором/загрузкой и проверяет четыре сочетания через config/get, reload и доступность загруженного image asset; initial-off, keyboard Space, Escape, reset и исходник/markers/layout также проверяются. Прежний #1154 lifecycle case сохранён. Синтаксис, selector contract и collection проверены; фактическое прохождение нового адресного случая в HA ещё не заявлено.
