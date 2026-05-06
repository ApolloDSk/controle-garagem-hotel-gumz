# Controle de Garagem — Hotel Gumz
## Como instalar e compilar o programa para Windows

---

### Pré-requisitos
- Node.js instalado (você já tem ✓)
- Conexão com a internet (só para o setup inicial)

---

### Passo a passo

**1. Extraia o ZIP**
Extraia a pasta `garagem-app` em qualquer lugar do seu computador.
Exemplo: `C:\Users\Douglas\garagem-app`

**2. Abra o terminal na pasta**
Clique com o botão direito dentro da pasta → "Abrir no Terminal"
(ou abra o Prompt de Comando e navegue até a pasta com `cd C:\Users\Douglas\garagem-app`)

**3. Instale as dependências**
```
npm install
```
Aguarde — vai baixar o Electron (~100 MB). Só precisa fazer isso uma vez.

**4. Baixe o PDF.js (necessário para funcionar offline)**
```
node setup.js
```
Isso baixa os arquivos do PDF.js para a pasta `pdfjs/`. Só precisa fazer isso uma vez.

**5. Teste antes de compilar (opcional)**
```
npm start
```
O programa abre direto. Se funcionar, está tudo certo.

**6. Compile o instalador .exe**
```
npm run build
```
Aguarde alguns minutos. Ao final, a pasta `dist/` vai conter o instalador:
`Controle de Garagem Setup 1.0.0.exe`

**7. Instale**
Clique duas vezes no `.exe` e siga o assistente de instalação.
O programa aparece no menu Iniciar e na área de trabalho.

---

### Resultado
- Ícone na área de trabalho: "Controle de Garagem"
- Funciona 100% offline
- Não abre nenhum navegador
- Aparece na lista de programas instalados do Windows
- Para desinstalar: Painel de Controle → Programas → Controle de Garagem

---

### Problemas comuns

**"npm não é reconhecido"**
→ Reinicie o computador após instalar o Node.js

**"electron-builder falhou"**
→ Tente: `npm install --legacy-peer-deps` e depois `npm run build` novamente

**O PDF.js não baixou (setup.js deu erro)**
→ Verifique sua conexão com a internet e rode `node setup.js` novamente
