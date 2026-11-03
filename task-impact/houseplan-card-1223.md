# #1223 — HA E2E: не надо

Источник: https://github.com/Matysh/houseplan-card/issues/1223.
Принятый SHA: a2ab12d74261ff9b337332ff4e872483c668eb86.

Изменена только копия closed wire schema отдельно поставляемого support-relay:
она принимает согласованный Zigbee low глобально и на пространстве. Код HACS,
пользовательские действия, HA API, config/layout/CAS и hooks не менялись.
Проверки package/projection и обоих validators прошли; отдельный relay suite
проверил настоящую loopback HTTP/parser поверхность: low принят, invalid и
unknown fields отклонены. Этот сервисный контракт не следует дублировать
через DOM обычного Houseplan HA journey.

Архив принятого relay и manifest подготовлены, production deployment не
выполнялся и не подтверждён. Перед выпуском нужна отдельная доставка принятого
relay по его README; опубликованный health сам по себе не доказывает code SHA.
Эта запись не объявляет production обновлённым и не разрешает выпуск беты.
