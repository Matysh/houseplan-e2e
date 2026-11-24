# House Plan #1551 — summary timing isolation

- Issue: https://github.com/Matysh/houseplan-card/issues/1551
- E2E impact: no HA test changes are needed. The runner isolates the browser timing check and keeps the 50 ms p95 limit. It does not change the summary controls or the HA data contract.
