# houseplan-card #1102

Вердикт: **не надо**.

Изменение передаёт существующий `rt.junction_baseline` в уже существующий валидатор `wall/node_move` только при совпадении ревизии, как у `node_delete`; внешний API/UI и структурные правила не меняются. Новый настоящий HA WS-тест покрывает exact/stale/missing baseline, отсутствие чтения `previous` только на exact, durable config readback и новую ревизию кеша. Существующие pure junction tests проверяют одинаковое принятие унаследованного нарушения и отказ нового нарушения с `previous` и `baseline_counts`, а node_move/параметризованные geometry tests остаются зелёными. Browser/E2E не даёт дополнительного oracle использования внутреннего revision cache.

До правки exact test RED: `baseline_counts` был None вместо counts. После `python -m pytest tests_backend -k 'node_move or junction' -q` PASS68 (2537deselected). Никаких новых E2E steps/harness изменений не требуется.

Принято: dev0543e57962d38a02601d6cb0be04ab3ecc767099, sourcee6f5968425e04d4a4a26852e0b108e81591a3c2f. CODEr1 GREEN H0/M0 [6467270957](https://github.com/Matysh/houseplan-card/issues/1102#issuecomment-6467270957), auto6467278038. ExactCI40674379163/40674379187/40674379122 SUCCESS; liveS8 проверен.
