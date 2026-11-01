# #1198 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1198.

Меняется только синтетическая проверка canvas surface gestures: desktop camera-фаза получает измеренную ширину host с учётом инспектора, а перед последующими wall transactions настоящее действие Fit возвращает стену в сцену после намеренных pan/zoom. Narrow clamp, все native camera/dialog/history/write assertions и реальные клики сохраняются. Product runtime/данные/права/HA-контракты не меняются. Реальные HA-сценарии остаются прежними; исходные FAIL сохранены и не выдаются за PASS.