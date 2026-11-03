# #1221 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1221.
Принятый SHA: 96ffe544474c6a0ffd40f005caa977afff308d26.

Первоначальная гипотеза о поломке graph migration опровергнута: второй
native target в synthetic Draw/Resize smoke попадал в плавающую подсказку
Walls, хотя оставался внутри SVG/stage/viewport. На неизменённом продукте
после обычного Zoom out полный smoke проходит, включая legacy/current
carrier, T-node identity, metadata, Undo/Redo и Resize.

Изменена только подготовка synthetic native smoke: публичный Zoom out,
строгая проверка видимой доступности через shadow hit-testing и отрицательный
свидетель на реальном overlay input. Все прежние графовые/исторические
оракулы сохранены. Production geometry, transport, CAS, hooks и сохранение
не менялись, поэтому нового HA E2E по этому изменению не требуется.

Это не отменяет существующую необходимость legacy/current graph journeys
и исправления их подготовки в
https://github.com/Matysh/houseplan-card/issues/1225. Реальные HA сценарии
не объявляются выполненными вследствие зелёного synthetic smoke.
