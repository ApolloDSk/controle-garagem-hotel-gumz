# HANDOFF — Reserva de Garagem do Hotel Gumz

> Documento de contexto para o próximo chat começar correto. Ler junto com `CLAUDE.md`,
> `PLANEJAMENTO.md` e o `RELATORIO-*` mais recente. A memória vive **nos arquivos**, não na conversa.

## Estado atual
- **Versão entregue: v1.2.0** (05/06/2026). Repo único: `ApolloDSk/controle-garagem-hotel-gumz`
  (branch `master`). ⚠ **Nunca** tocar nos repos do **Garage Spot** (`garagespot-*`) — outro projeto.
- App canônico: `garagem-app/index.html`; standalone (Chrome): `garagem-app/controle-garagem-standalone.html`
  (regenerar com `node build-standalone.js` em `garagem-app/` sempre que mexer no `index.html`).
- Stack: HTML/JS/CSS puro + PDF.js + IndexedDB (DB `garagemGumz` **v2**: stores `reservas`,
  `contatos`, `gestao`). Sem backend, sem APK.

## O que a v1.2.0 entregou
1. **Aba Gestão:** Empresa (`[empresa]`), Funcionários (lista dinâmica + padrão único →
   `[funcionario]`), Modelos de Mensagens, Backup/Restauração.
2. **Modelos** por status (verificando/overbooking), até 3 cada, padrão por categoria; chaves
   `[nome] [data] [canal] [empresa] [funcionario]` com **substituição real** (nunca literal),
   **autocomplete + chips**, **legenda + botão "?"**.
3. **Envio (Contato):** preview substituído → trocar modelo 1/2/3 → **Editar só o envio** (não
   altera o modelo salvo) → `wa.me`. amarelo→verificando, vermelho→overbooking; azul fora (link simples).
4. **Backup:** exportar (dump de stores) + importar **Mesclar** (não-destrutivo) / **Substituir**
   (com confirmação). Arquivo inválido não quebra.

## v1.1.0 (mantido)
Abas Mapa de Reservas/Contato com ícones; copiar PMS/OTA; telefone Confirmar↔Editar; ordenação das
vagas; info de upload; check-in no passado com borda cortada.

## Testes (versionados em `tests/`) — 140/140
- `npm install` (jsdom, fake-indexeddb, @playwright/test) + `npx playwright install chromium`.
- `npm run test:engine` (102) · `npm run test:integration` (27) · `npx playwright test` (11).
- **Regra:** tudo verde antes de commitar; **sem `test.skip`** mascarando; corrigir causa raiz.
- Funções puras testáveis ficam **dentro** dos marcadores `// ===ENGINE START/END===` do `index.html`.
- ⚠ Variáveis de estado (`gestaoConfig`, `contatoGrupos`, `db`) são **escopo de módulo** (não estão
  em `window`). Para testar, use os **handlers globais** (`gestaoSetEmpresa`, `gestaoSetModelo`,
  `abrirEnvio`, `aplicarImport`…) e o accessor **`getGestaoConfig()`** / `dbGetAll(store)`.

## Avisos que NÃO podem se perder
- **Substituição nunca deixa chave literal** (valor real ou vazio). `[data]` = entrada+saída.
- **azul/confirmada fica fora** do sistema de modelos (decisão de escopo; usa `wa.me` simples).
- **Migração não-destrutiva:** novo store via `onupgradeneeded`; semeadura idempotente (só cria o
  registro `config` se ausente). Nunca sobrescrever config existente.
- **Limitação de caminho do navegador** (`C:\fakepath`) — nunca inventar caminho (v1.1.0).
- **Check-in no passado** só aparece se constar no PDF (exportar Desbravador começando dias antes).
- Lógica de alocação (amarelos/azuis/score/best-fit/overbooking) e o Mapa são **intocáveis** aqui.

## Próximos passos
- **v1.3.0 — Edição manual:** mover reserva de vaga (confirmação) e **data proibida**; distinguir
  "mudar só de vaga" de "mudar de data" (prévia "ghost", confirmação específica).
- **Adiados:** mapeamento do nome do canal para `[canal]`; múltiplas empresas; modelo para
  reservas confirmadas/azuis.

## Tags
- `pre-v1.0.0`, `v1.0.0`, `pre-v1.1.0`, `v1.1.0`, `pre-v1.2.0`, `v1.2.0` (todas no remote).
