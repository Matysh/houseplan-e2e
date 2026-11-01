# Task impact #1183

Вердикт: **не надо**.

Задача: https://github.com/Matysh/houseplan-card/issues/1183.
Материал: issue/1183-readable-mixed-opacity-native, author b7ec51fa754b36bedb55a4fbee0769103c00a9ac, база dev740b42784ef3579f154c8488b0de257c28f68284; product fingerprint39760e6c6f7b630d2ede693ff5378ebe59ffaa3f61f89eed567f2a1723058a36.

В общем compact color field пустая прозрачность с видимым mixed placeholder делит свободную ширину с HEX. Поле36px и заполненная alpha28px, hooks, значения и commit/preview/Escape/history/persistence остаются прежними. Нового пути browser → HA write → reload → persistence нет; существующий tests/editor-decor.admin.spec.mjs остаётся применим. Полные подписи на en/ru для всех шести типов выделения и соседние операции проверяются продуктовым smoke_decor_multiselect на настоящем Chromium. Light/dark golden фактически просмотрены; повторные изображения на новой принятой базе побайтно совпали.

После S8 #1180–#1182 source и все входы адресных проверок сверены с подготовленным материаломe6453ba: изменения только в остальных offline smoke observers/review metadata. Product fingerprint39760 и пять task-файлов сохранились; сохранённые проверки не объявляются новым исполнением.

Фактических изменений E2E для накопления перед бетой нет. Live HA E2E этим документом не объявляется выполненным; полный exact Validate и каноническая приёмка кадров остаются релизному процессу.