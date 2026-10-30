# Task impact #1154

Вердикт: **надо**. Изменения внесены перед beta.6.

Задача: https://github.com/Matysh/houseplan-card/issues/1154.
Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1154#issuecomment-6524391131.
Accepted dev: 1fa2b03467fe521d3a071c5bd7e617ebde6a542a.
CODE r2: https://github.com/Matysh/houseplan-card/issues/1154#issuecomment-6524382147.

Нужен настоящий HA journey: настройки пространства → Копировать → поле имени
остаётся открытым после завершения старого окна; введённое имя сохраняется,
до подтверждения серверная конфигурация не меняется; Cancel возвращает настройки.
Существующий spaces.admin.spec.mjs проверял добавление/удаление, но не копирование.

Добавлен tests/space-copy-lifecycle.admin.spec.mjs. Он использует настоящий HA,
публичные data-hp/accessible controls, реальный ввод и серверный config oracle;
не подменяет HA lifecycle/constructors и не отправляет синтетические события.
Наблюдение750ms покрывает отложенное завершение старой оболочки. Версия beta.5
и старше явно skip с причиной: это не PASS исправления. Точный beta.6 candidate
должен исполнить сценарий; результат реального HA-прогона фиксируется отдельно.

Discovery/contract lint и ordinary unit suite проверяются перед публикацией
изменений companion. Product smoke и genuine offline verify из задачи не
выдаются за исполнение этого HA journey.
