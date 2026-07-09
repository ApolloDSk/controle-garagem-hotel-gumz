# amostras/ — PDFs reais para validação

Coloque aqui os PDFs **reais** exportados do PMS para validar o parser contra o documento de verdade.
Os `.pdf` desta pasta **não são versionados** (contêm dados de hóspedes) — só este README fica no repo.

## Nomes reconhecidos pelos testes
- **Comandas em aberto:** qualquer arquivo cujo nome contenha `comanda` (ex.:
  `Comandas_em_aberto_-_08jul26.pdf`) → valida a extração de hospedados (v1.5.1.1).
- **Listagem de Reservas:** qualquer arquivo cujo nome contenha `reserva` ou `listagem`
  (ex.: `LISTAGEM RESERVA.pdf`) → confere que as reservas continuam sem regressão.

## Como rodar
```
npx playwright test -g "\[real\]"
```
Se a pasta não tiver os PDFs, os testes `[real]` são **pulados com motivo** (não mascaram bug):
a validação definitiva é o usuário subir o Comandas real pelo slot **Hospedados** no app.
