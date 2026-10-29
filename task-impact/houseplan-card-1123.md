# Task impact #1123

Вердикт: **не надо**.

Исходная задача: https://github.com/Matysh/houseplan-card/issues/1123.
Accepted dev: 72c63464ae88cd5714e60ab68da3d09ae04d39b4. CODE: https://github.com/Matysh/houseplan-card/issues/1123#issuecomment-6506860463. Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1123#issuecomment-6506868603.
Авторский материал: 5b1c2c106a1b2fc16723e2058228c71b997c885b.

Изменение ограничено B/C: декларации мутационных свидетелей, обычные demo/unit
наблюдения, подготовка test-build и вычисляемый CI inventory. Продуктовые
исходники и установочный frontend snapshot не меняются. Public data-hp,
HA transport/permissions/bootstrap, конфигурация и её миграции не затронуты.

Нового HA journey не требуется: он не даёт дополнительного oracle для
reachability registry, ошибок TypeScript preparation или условности demo
наблюдения. Десять ordinary браузерных guards, адресные unit tests и обязательный
локальный гейт прошли; CI docs/product/tooling зелёные на авторском материале.
Они не доказывают caught. Все 2052 определения статически проверены; мутанты
не исполнялись, поимку должен подтвердить следующий штатный nightly.
Старый прерванный aggregate 40829602818 остаётся неполным.

Накопленных изменений companion по этой задаче: нет. Сценарии E2E, thresholds,
hooks, masks и релизная политика сохраняются. Новую бету этот task не выпускает.
