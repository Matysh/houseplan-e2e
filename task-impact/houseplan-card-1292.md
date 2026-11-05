# #1292 — real HA: исполнено

Источник: https://github.com/Matysh/houseplan-card/issues/1292 .
S8 dev644cae87c40425c31fb1b181574f48e434ffb8bd; независимое ревью41957391548 принято.

Исправлен Resize producer: сохранять каждую неизменённую точную компоненту
унаследованной точки, а не восстанавливать обе по решётке при изменении одной.
Глобальные допуски, пересечения, физические/junction guards и writer не ослаблены.

На частном installable candidate source75c6c7fdfcfcf7171e835fd9b51181bd91cfe3e3,
ZIP SHA256217a3906d84e6bf5ac69696a052c78c2b8c22dbe1fd5dcb8ee33f32a5843c799,
HA2026.10.4 прошёл неизменённый полный first-floor #1264 journey:
Resize−3, Keep room-f, Resize+1, Keep room-b, точные Undo/Redo/reload.
Business1/1, setup3/3, ноль skip/retry; собственная лаборатория8LxcoO,
контейнер удалён адаптером. Raw root output/issue-1292/fixed/ha-diagnostic-result.json.
Неизменённый smoke_resize_pointer_real_plan тоже PASS на этом исправленном runtime.
Это частный исправленный пакет; опубликованные beta.5 ZIP/тег не перезаписывались.

75c6c7f →968966c4 — rebase с тем же файлом алгоритма. После первого ревью
добавлены настоящие T-атомы в corner-only regression, assert выбора ветки и
перенос changelog в Unreleased; алгоритм не менялся, только его комментарий.
Контроль отката двух corner-only строк: atoms2/2 PASS, corners0/2 FAIL на literal q.
Финальный S6 на644cae87:7/7 PASS. Реальный HA не повторялся ради теста/документации;
частный ZIP не объявляется артефактом всего rebased HEAD. Полного stable повтора нет.