# #1119 — итоговая оценка E2E

Вердикт: **надо**. Реальное пересечение ширины HA-контейнера — самостоятельный интеграционный риск, который синтетический native browser fixture полностью не закрывает.

Предложение уже реализует root в companion houseplan-e2e: существующий маршрут редактирования размера получает явно широкий viewport1800; отдельный случай измеряет публичный ha-card.getBoundingClientRect().width и обычным изменением окна последовательно пересекает 1023 → 1024 → 1025 → 1024 → 1025 px. Контракт UI010: при ширине <1024 Properties скрыта, при >=1024 доступна. Сохраняются выбранное устройство THERMO, текущее значение, configuration/layout и их ревизии; изменение размера контейнера не пишет на сервер.

Смежные product observations: smoke_approved_ui проверяет фактический owner width, видимость и сохранение drafts/focus; smoke_properties_panel сохраняет wheel/footer/scroll/selection assertions на широком owner; native7+3lazy-orders и #508 executed на eb778. Точный список запусков/идентичностей остаётся в acceptance receipt и journal. Эти проверки не заменяют реальный HA.

Статус companion: root owns changes/push. Syntax, lint и discovery проверены root; **actual HA execution на точной beta4 ещё не выполнено**. Перед бетой нужен успешный реальный прогон; нельзя переносить synthetic PASS в HA-verdict.

CODE r1 GREEN H0/M0, циклы0/4: https://github.com/Matysh/houseplan-card/issues/1119#issuecomment-6488326628. Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1119#issuecomment-6488332868. Материал118bb0814ccd5d25852642ee1849982543b36d6b; accepted dev deliveryb2bdc4ad1486931406546d45cbc6d71686a0b53a. Root переносит итог в companion; внешний документ не меняет замороженную ветку продукта.

Текущий дополнительный product receipt: source118bb0814ccd5d25852642ee1849982543b36d6b, FP88e76cd097a0172687469e8c845a0939f37182bfdd5fbf484d74b3844fd74bb1. Fresh native7/3lazy-orders и #508 прошли на88. CI40814085941 SUCCESS: выбранные86Golden checks и56smokes PASS, включая строгую исправленную battery fixture; это task-scope, не полная матрица/реальныйHA. Handoff6487720249, actualS8 подтверждён; CODE/S8 ссылки выше. Source меняет только B/ledger/C относительно422; product FP тот же.
