# #1203 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1203.

Golden safe-resize кадр явно выбирает полный Lit snapshot удерживаемого resize preview, как в прежнем принятом эталоне. Preview/controller refs, dragging, геометрия, config/layout/revisions и write-chain сохраняются; pointerup не отправляется. Меняются только synthetic capture harness и его semantic guard, без product renderer/gesture/storage/HA-путей. Это не утверждение исправления исторического различия full/live renderer и не автоматическое принятие эталона.

Адресные независимые подготовки изменённого harness дали 3 одинаковых dark PNG и прошли light counterpart; исходные A/B сохранены. Нового или изменённого HA сценария не требуется. Финальные beta13 HA проверяются отдельно общим release runner.