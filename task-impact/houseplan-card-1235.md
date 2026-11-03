# #1235 — HA E2E: надо

Источник: https://github.com/Matysh/houseplan-card/issues/1235.
Принятый product SHA: a52e6cb44514c55826400c7f3b12623fe76081bf.

В существующем real-HA runtime recovery journey временно вернуть404 первого
summary-root чанка настоящей сборки, затем восстановить asset и нажать native
Retry. Nonce-загрузка должна вернуть ready и видимую сохранённую сводку, без
подмены модуля fixture и без фоновых повторов. Ошибка общей зависимости и чужой
fingerprint остаются reload-only; состояние разных карточек независимо.

Адресные ABI/unit и native recording harness проверки прошли. Real HA journey
ещё не выполнен; учесть в #1225 перед бетой. Это не разрешение на публикацию.
