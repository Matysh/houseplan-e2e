# Task impact #1124

Вердикт: **не надо**.

Исходная задача: https://github.com/Matysh/houseplan-card/issues/1124.
Accepted dev: 3779df5a9ef402cbb0daebd6994b666323b6ae3f.
CODE: https://github.com/Matysh/houseplan-card/issues/1124#issuecomment-6511717199.
Автоматический S8: https://github.com/Matysh/houseplan-card/issues/1124#issuecomment-6511724175.
Авторский материал: 9f7b3cc7b24e73b2d4da1273bbaa359c5949015d.
Авторский ребейз на dev52f572a6: fc64641b9178ae238054fcb155b432963858456f;
вне docs/reviews разницы с исходным материалом нет.

Изменение B/C ограничено правами GITHUB_TOKEN в validation workflows,
генератором профилей, ordinary policy regression и сопутствующей документацией.
Установленный Houseplan, public data-hp, HA роли/транспорт/bootstrap/данные
и пользовательские сценарии не меняются. HA E2E не даёт oracle для прав
GitHub Actions; нужны YAML policy checks, реальное CI и последующий CodeQL.

Проверка фиксирует workflow-default contents read, сохранение существующих
job capabilities и actions read для cross-run producer download у bundle.
Четыре YAML охватывают 44 job; сравнение до/после подтверждает неизменность
triggers, conditions и команд шагов. Ordinary regression был красным на старом
отсутствующем default, итоговый ci-profiles suite —14/14 PASS, gate:small зелёный.
CodeQL closure на main не подменяется S8: исходные 32 OPEN alerts требуют
попадания исправления в main и нового CodeQL анализа.

Накопленных изменений HA E2E по этой задаче нет. Сценарии companion не правились.


Достаточность scopes дополнительно проверена по stable/beta/night call-sites:
права публикации contents write, dispatch actions write, отдельные process/E2E
токены сохранены. Release/night ordinary contracts38/38 PASS. Full fresh
Validate40964200582 attempt2 SUCCESS; исходный attempt1 FAIL и его Golden/perf/
Cancel нестабильность сохранены в houseplan-card#1133. Nonfresh40972582037 SUCCESS:
bundle job123792893891 действительно восстановил оба producer artifact из
предыдущего run и проверил их inventories с actions read/contents read.
Проверка точного ребейзнутого tip: https://github.com/Matysh/houseplan-card/actions/runs/40977338353.
Реальная публикация stable/beta не запускалась.
