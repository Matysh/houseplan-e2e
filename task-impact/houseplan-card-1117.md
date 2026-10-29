# E2E impact — houseplan-card #1117

Вердикт: **не надо** отдельного нового E2E journey для этой дельты.

Исторический map_index остаётся серверным transient provenance-полем. DTO, публичные history/list/get, UI Show/Hide, ACL, physical lease и persisted config/layout/trails не меняются. Новая optional-slot форма доказана оригинальным pinned producer, unit-матрицей выбора маршрута и настоящим authenticated WS handler в HA harness. Существующие клиентские unit и browser context/geometry smokes отдельно доказали принятие штатного DTO, Show/Hide, stale-owner отказ и геометрию Flat/2.5D.

Повтор такой же predicate-матрицы в companion E2E дублировал бы backend. Добровольный read-only Show/Hide реальной уборки остаётся полезной полевой проверкой producer-совместимости; здесь она повторно на личной даче не выполнялась. При отдельном расширении настоящего HA+browser public-provider journey #999 optional-slot record следует включить как обычный вход без отдельного journey и обязательного доступа к частной инсталляции.

Проверки: 197 targeted backend/real HA PASS; 43 client unit PASS; geometry smoke 7/7 и context smoke 35/35 PASS; normal protected push GREEN 271 с; exact CI product 40765991998, docs 40765992259, tooling 40765992221 SUCCESS.

Source: 1b985c5659a8ef32a2dbf6387f691a9cad669fb5.
Accepted dev: c874bb26bfaf691d13d4b4c7c85dacdf0ecd14ab.
CODE r1: https://github.com/Matysh/houseplan-card/issues/1117#issuecomment-6480714593 — GREEN, H0/M0, findings absent.
Auto S8: https://github.com/Matysh/houseplan-card/issues/1117#issuecomment-6480723974.

Live S8-merged read back; issue remains open for release manager. Координатор независимо проверил live S8 и оценил влияние; отдельный HA browser journey для этой серверной дельты не нужен.
