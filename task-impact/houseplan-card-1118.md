# Влияние Houseplan #1118 на e2e

- Исходная задача: https://github.com/Matysh/houseplan-card/issues/1118
- Дата: 2026-10-29.
- Вердикт: **не надо**.
- Принято в dev `d1fdc3c9294e1be8352b6a0b69b2bb4fd0766990`.
- CODE r1 GREEN H0/M0: https://github.com/Matysh/houseplan-card/issues/1118#issuecomment-6482689789
- Автоматическое S8: https://github.com/Matysh/houseplan-card/issues/1118#issuecomment-6482697701

Только Golden-сцена geometry-plan-editor-dark включена в существующую scoped
перерисовку перед снимком. Продуктовый A-код, HA API, конфигурация и публичный
браузерный сценарий не менялись. Адресный callback/unit (4/4), десять независимых
Chromium (30 одинаковых target кадров и четыре неизменных соседних) и независимые
CODE unit/static checks покрывают изменённый capture механизм. Запуск нового
путешествия на настоящем HA его не исполнял бы.

Канонический кадр намеренно отличается от прежнего index на один AA-пиксель;
это явный visual intent и отдельная приёмка полного beta artifact. E2E-решение
не заменяет Golden/baseline review и общий прогон точного beta-кандидата.
