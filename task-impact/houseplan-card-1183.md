# Task impact #1183

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1183.
Материал: issue/1183-readable-mixed-opacity, author3197a18ec, база dev96a97b8f74bf66d6c0c9423ec6657eabb052416d; product fingerprint a269217a3922b75373e275d73caea568b34894b4daf2393f2e7f3cae0dce5825.

В общем compact color field только пустая прозрачность с mixed placeholder делит свободную ширину с HEX. Поле36px и заполненная alpha28px, hooks, значения и commit/preview/Escape/history/persistence остаются прежними. Нового пути browser → HA write → reload → persistence нет; существующий tests/editor-decor.admin.spec.mjs остаётся применим. Полная подпись на en/ru и соседние операции проверяются обычным продуктовым smoke_decor_multiselect на настоящем Chromium, оформление — targeted golden обеих тем.

Фактических изменений E2E для накопления перед бетой нет. Live HA E2E этим документом не объявляется выполненным.