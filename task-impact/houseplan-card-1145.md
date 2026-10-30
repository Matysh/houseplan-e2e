# #1145 — влияние на E2E после S8

Вердикт: **не надо** — новый HA journey или изменение существующего контракта E2E не требуется.

Задача: https://github.com/Matysh/houseplan-card/issues/1145.
Принятый dev: `a8fa750ee42d460b97d840773f033ac999f607a4`.
Материал CODE r2: `8ae5801856813629bfbb0cce8e91b4c29851109c`.
Зелёное независимое CODE r2 (High 0 / Medium 0): https://github.com/Matysh/houseplan-card/issues/1145#issuecomment-6518950550.
Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1145#issuecomment-6518956629.
Точный task CI: https://github.com/Matysh/houseplan-card/actions/runs/41028562696 — SUCCESS.

Адресная CSS/классовая полировка десяти пунктов: основные действия, отступы/ряды формы, тематические цвета, disabled cursor,44px обычные контролы и touch-hover сводной. Настройки, записи HA, data-hp, маршруты и действия не меняются. Сценарии editor-decor.admin.spec.mjs, editor-devices.admin.spec.mjs, settings.admin.spec.mjs и summary.admin.spec.mjs уже проходят настоящие диалоги и сохранение/перезагрузку. Новый отдельный E2E дублировал бы продуктовые computed-style/native-input/Golden oracles.

Адресные browser smoke и пять task Golden находятся в продукте; в частности обычные44px и компактные36px проверяются раздельно. Два старых product smoke ожидания32/40px обновлены в самом продукте, прочие поведенческие проверки сохранены. Companion не проверяет эти прежние числовые размеры/пустые CSS-классы, его assertions не ослабляются.

Накопленных правок E2E нет. До выпуска беты обязателен полный реальный HA E2E точного финального candidate, включая уже подготовленную version-aware адаптацию #1132. Task CI и синтетические кадры не объявляются реальной HA/GPU приёмкой.