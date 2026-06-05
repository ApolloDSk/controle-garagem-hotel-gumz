# HANDOFF — Reserva de Garagem do Hotel Gumz

> Documento de contexto para o próximo chat começar correto. Ler junto com `CLAUDE.md`,
> `PLANEJAMENTO.md` e o `RELATORIO-*` mais recente. A memória vive **nos arquivos**, não na conversa.

## Estado atual
- **Versão entregue: v1.1.0** (05/06/2026). Repo único: `ApolloDSk/controle-garagem-hotel-gumz`
  (branch `master`). ⚠ **Nunca** tocar nos repos do **Garage Spot** (`garagespot-*`) — outro projeto.
- App canônico: `garagem-app/index.html`; standalone (Chrome): `garagem-app/controle-garagem-standalone.html`
  (regenerar com `node build-standalone.js` em `garagem-app/` sempre que mexer no `index.html`).
- Stack: HTML/JS/CSS puro + PDF.js + IndexedDB. Sem backend, sem APK.

## O que a v1.1.0 entregou
1. Abas "Mapa de Reservas" (ícone calendário) e "Contato" (ícone WhatsApp).
2. Copiar nº **PMS** e **OTA** ao clicar (clipboard + fallback `file://`), feedback "Copiado!".
3. Telefone **Confirmar↔Editar** (bloqueia/desbloqueia o campo; valor salvo inalterado).
4. **Ordenação das vagas** cima↔baixo (persistida em `localStorage`; não altera a alocação).
5. **Info de data/hora do upload** + nome ao clicar (limitação de caminho do navegador documentada).
6. **Check-in no passado:** hóspedes ainda hospedados aparecem com **borda esquerda cortada**.

## Testes (versionados em `tests/`) — 98/98
- `npm install` (jsdom, fake-indexeddb, @playwright/test) + `npx playwright install chromium`.
- `npm run test:engine` (74) · `npm run test:integration` (16) · `npx playwright test` (8).
- **Regra:** tudo verde antes de commitar; **sem `test.skip`** mascarando; corrigir causa raiz.
- Funções puras testáveis ficam **dentro** dos marcadores `// ===ENGINE START/END===` do `index.html`.

## Avisos que NÃO podem se perder
- **Limitação de caminho do navegador:** retorna `C:\fakepath\...`; exibir nome+data/hora e só
  mostrar caminho real se o ambiente fornecer (Electron). **Nunca inventar caminho.**
- **Pré-requisito do PDF:** check-in no passado só aparece se a reserva constar no PDF — se preciso,
  exportar o relatório do Desbravador começando alguns dias antes de hoje.
- Lógica de alocação da v1.0.0 (amarelos/azuis/score/best-fit/overbooking) é **intocável** aqui.

## Próximos passos (plano de patches)
- **v1.2.0 — Gestão + Modelos de Mensagens:** aba Gestão; modelos por status (até 3 cada) com
  chaves `[nome] [data] [canal] [empresa] [funcionario]` (substituição real, autocompletar,
  legenda + "?"), numeração 1/2/3 + padrão editável; cadastro de empresa e funcionários; ao enviar,
  conferir/trocar modelo/editar só o envio.
- **v1.3.0 — Edição manual (mover de vaga, data proibida) + Backup/Restauração (Export/Import).**
- **Adiados:** mapeamento do nome do canal para `[canal]`; suporte a mais de uma empresa.

## Tags
- `pre-v1.0.0`, `v1.0.0`, `pre-v1.1.0`, `v1.1.0` (todas no remote).
