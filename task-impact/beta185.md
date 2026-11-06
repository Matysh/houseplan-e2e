# Передача E2E в 1.85.0-beta.1

## Реализация перед 1.85.0-beta.1 (2026-11-06)

Добавлены реальные HA browser journeys в `tests/beta185.admin.spec.mjs` на подготовленном кандидате houseplan-card `0ce2c7c7b8def6f7ef5dd6522d7d0816c107c28f`:

- `empty View and the room area helper survive real writes, reader and kiosk contexts`: GUI создания пространства, пустой View/CTA, pan без записи config/layout, reader и kiosk, live adoption скрытого содержимого и его удаления, создание комнаты, неизменный фильтр занятых area, постоянная подсказка, сохранение выбранной свободной area и повторное открытие после reload.
- `dangling endpoint attach keeps exact graph identity through ACK, Undo Redo and reload`: нативный drag к горизонтальной/вертикальной/диагональной перегородке и стене комнаты; исходный ID, независимая точная рациональная проверка split, неизменные остальные узлы, замкнутая комната, Escape/late release, Undo/Redo с тем же графом, CAS и reader ACL отказ, reload. Запись снимается с реального исходящего WS, авторизация не перехватывается/не подменяется.
- `Straight and Spiral hover have one owner, no write, native cancellation and durable placement`: реальные mouse input, отсутствие записи до размещения, живое HA state update без второго владельца, доступное меню удаления подходящего узла, совпадение preview/placement, Undo/Redo, отмена удерживаемого и hover-only черновика, следующий Select/nav, выход из редактора и reload.
- `Shift rotation is absolute 45 degrees for all decor families and backdrop with one history action`: rect/ellipse/text/furniture/uploaded image/backdrop с углом17°, обычная точность, keydown/keyup без движения, Shift commit45°, один Undo/Redo, Escape без записи и reload. Проверяются публичные SVG frames и реальный HA config, приватные поля продукта не меняются.

Это основная пользовательская E2E-проверка новых швов, а не заявление о переносе каждой низкоуровневой комбинации из handoff в браузер. Матрицы topology/openings/capability retirement/authority refusal, границы hit targets и бюджеты удерживаемого кадра остаются в адресных TS/Python/native/harness тестах продукта. Ранее сохранённые факты S6 и ограничения исходных handoff не переписываются. Конвертеры и synthetic smoke не выданы за настоящий HA browser.

Адресный прогон: empty View/area, attach и Straight/Spiral PASS; отдельный Shift прогон — все6семейств PASS (2026-11-06, HA2026.10.4, собственный loopback Docker lab). Окончательный frozen companion SHA и итог выполнения общей beta/remainder выборки фиксирует единый отчёт выпуска. Промежуточные отказы настройки сценариев сохранены в release evidence; продуктовые ожидания, visual baselines и допуски не ослаблялись.
## Выпуск подтверждён

[1.85.0-beta.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.85.0-beta.1) опубликована 2026-11-06. Проверенный product SHA: `0ce2c7c7b8def6f7ef5dd6522d7d0816c107c28f`; проверенный companion SHA: `f46e8e37154ca1103a66da536c6a09ec88d5af9f`.

Настоящий общий HA прогон: `20261106T171020508-61647dde`, **97/97 business PASS, 10/10 setup PASS, 0fail, 0skip, 0unexecuted**. Это10основных journeys +2first-run +1upgrade с выпущенной v1.84.0 +84remainder journeys (включая все4новых случая выше). Пустые remainder first-run/upgrade выборки правильно not-required, не зачтены как выполненные тесты.

Итоговый единый beta report `20261106T173226025-ddb4e396`: schema1, event=beta, materialClean=true, exact product SHA выше, status=passed;38групп с34применимыми зачётами. Его публичная квитанция сохранена в [release state](https://github.com/Matysh/houseplan-card/blob/process-release-state/releases.json), кандидат `v1.85.0-beta.1-20261106`. Все326golden прошли после точечного принятия владельцем трёх кадров #1334. Проверка доставки подтвердила публичный feed и скачиваемый ZIP SHA256 `8fc4ae42b03e3f5dfaf0f0722880e4b328d634430deb55d2bc7f9af3cb5c96b5` (2063091bytes).