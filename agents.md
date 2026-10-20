# Instruções para Agentes de IA

## Regras de codigo

- Sempre usar as classes e componentes do Bulma para CSS. `src/renderer/styles.css` deve
  conter apenas ajustes finos e tokens visuais.
- Usar cores sólidas e superfícies planas. Evitar degradês no fundo, nos botões e na
  barra de progresso; o destaque de categoria deve ser feito com uma cor sólida.
- O menu lateral e agrupado nas categorias Migração, Backup/Conversão, Limpeza e
  Auditoria/Diagnóstico, definidas em `src/shared/tools.js`.
- Isolar todo acesso ao Node/Electron no processo principal e expor uma API minima e
  explicita em `src/preload/preload.js` com `contextBridge`. Nunca habilitar
  `nodeIntegration`.
- O renderer nunca deve receber um caminho de script ou flag arbitraria. Envie apenas o
  `scriptName` e os valores dos campos; o processo principal monta os argumentos a partir
  de `src/shared/tools.js`.
- Tratar `stdout` e `stderr` do Perl linha a linha, extraindo progresso via regex
  tolerantes (variacoes em ingles e portugues, numeros de mensagens, pastas).
- Manter a interface modular em JavaScript puro, com funções pequenas de renderizacao,
  sem framework adicional.
- Toda operação de arquivo deve usar caminhos resolvidos a partir de `dataRoot` e validar
  que logs solicitados estao dentro de `logs/`.
- Nunca registrar senhas em logs, mensagens de erro ou no histórico. Redigir a linha de
  comando antes de gravar.
- Nomes de ferramentas, botoes e mensagens de interface em portugues do Brasil.
- Sem comentarios desnecessarios no codigo.

## IPC

Canais `invoke` (renderer -> main):

- `tools:list`
- `system:info`
- `config:get`
- `config:save`
- `run:start`
- `run:stop`
- `run:active`
- `run:history`
- `progress:get`
- `log:read`
- `log:open`
- `logs:open-folder`

Canal de eventos (main -> renderer):

- `run:event` com `{ type: 'started' | 'log' | 'progress' | 'status' | 'done', ... }`

## Verificações antes de concluir uma tarefa

- `node --check` em todos os arquivos JS alterados.
- Executar `npm start` (ou teste de fumaca equivalente) quando viavel.
- Atualizar `memory.md` com o que mudou, bugs conhecidos e proximo passo.
