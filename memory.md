# Memoria e Estado do Projeto

## Implementado

- Estrutura completa do app Electron (`src/main`, `src/preload`, `src/renderer`,
  `src/shared`, `assets`, `scripts`, `logs`, `progress`, `tools`).
- Splash screen de 4 segundos com inicialização do SQLite em paralelo.
- Banco SQLite com tabelas `configurations` e `runs`; senhas cifradas via
  `safeStorage` (fallback base64), histórico e recuperacao de execuções interrompidas.
- 24 ferramentas mapeadas em quatro categorias em `src/shared/tools.js`, com formularios dinamicos,
  validacao no processo principal e montagem segura de argumentos.
- Executor com `spawn`, captura de stdout/stderr, redacao de senhas, log em arquivo,
  parser de progresso e snapshot JSON em `progress/`.
- IPC seguro via `contextBridge`, eventos de log/progresso/status/fim para o renderer.
- Interface Bulma com sidebar, hero por ferramenta, status da última execução,
  formulario de credenciais, opções, checkbox Resume, barra de progresso, painel de log
  e histórico com ações "Ver" e "Abrir".
- Rodape fixo com o texto solicitado e link "Sobre" que abre um modal com versao,
  tecnologias, origem dos scripts, agradecimentos e objetivo do aplicativo.
- Resumo amigavel da execucao com progresso, mensagens, pastas, duracao, resultado e
  atividades recentes. O terminal completo fica em bloco recolhido, acessivel por
  "Ver processamento".
- Logo de borboleta gerado (`assets/logo.png` e `assets/logo.ico`) e splash.
- Visual revisado com cores solidas, sem degrade, e agrupamento do menu em Migração,
  Backup/Conversão, Limpeza e Auditoria/Diagnóstico.
- Suporte a ferramentas com arquivos temporarios de usuarios (`migrateIMAP.pl` e
  `maildir_to_imap.pl`), apagados ao final da execucao.
- Strawberry Perl portatil 5.42.3.1 empacotado em `vendor/strawberry/` e copiado para
  `resources/strawberry/` no build Windows; resolucao automatica de `perl.exe` e PATH.
- Script `tools/prepare-perl.js` baixa/verifica/extrai o runtime minimo do Perl.
- Configuração do electron-builder com `scripts/` em `extraResources`.
- Documentação: `spec.md`, `agents.md`, `README.md`, `memory.md`.

## Decisoes tecnicas

- Dados graváveis na raiz do projeto em desenvolvimento e em `userData` no app
  empacotado.
- Uma execução por vez; trocar de ferramenta e bloqueado enquanto houver processo ativo.
- Resume: `-U` no imapcopy; natural no imapsync; desabilitado nas demais ferramentas.
- Progresso de imapcopy usa `-j 1` para emitir "Copied X of Y messages".
- Logs são limitados a 1 MB por leitura na interface; o arquivo completo permanece em
  disco.
- Bulma e vendorizado em `src/renderer/vendor/bulma.min.css` via `tools/copy-vendor.js`.

## Validacoes executadas

- `node --check` em todos os arquivos JS.
- Teste do SQLite (salvar/ler configuração cifrada, criar/finalizar execução, histórico).
- Teste do executor com scripts Perl simulados: progresso, falha por exit code,
  interrupcao por SIGTERM e arquivo de progresso.
- Teste de fumaca do Electron via DevTools Protocol: 24 ferramentas em 4 categorias, IPC, troca de
  ferramenta, formularios dinamicos e tema claro.
- Execução real do `imapPing.pl` contra `127.0.0.1` (conexão recusada) pela interface,
  com status `Falha`, log, histórico e progresso atualizados.
- Empacotamento `electron-builder --dir` validado: `src/`, `assets/`, `app.asar` e
  `resources/scripts` presentes; app empacotado inicializou e encontrou os 25 scripts.
- Build NSIS Windows 1.0.7 (referencia do repositorio do projeto) em
  `dist/Turbo IMAP Setup 1.0.7.exe` (~158 MB).
- Runtime Strawberry Perl 5.42.3.1 empacotado em `resources/strawberry`; `perl.exe`,
  IO::Socket::SSL, Net::SSLeay e `imapPing.pl` testados via Wine a partir do pacote.
- Correcoes de compatibilidade Windows nos scripts: `imap_to_maildir.pl` usa
  `Sys::Hostname` em vez de `uname`; `migrateIMAP.pl` nao depende mais de `head`;
  notificacao por sendmail e `chown` sao ignorados no Windows.
- `sqlite3` Windows x64 validado no pacote via `ELECTRON_RUN_AS_NODE=1` + Wine (query
  `SELECT 1` executada com sucesso).
- `imap_to_maildir.pl` agora faz streaming das mensagens direto para o Maildir, usa
  `binmode`, gera nomes compativeis com Windows (`!2`) e sanitiza nomes de pastas.
- Fluxo de download do `imap_to_maildir.pl` validado com servidor IMAP simulado e dois
  tamanhos de mensagem diferentes (conteudo gravado corretamente).
- Nova ferramenta "Backup IMAP para Thunderbird" usando IMAPtoMbox com prefixo de
  arquivos, filtro de data e guia `LEIA-ME-THUNDERBIRD.txt` na pasta de destino.
- Painel de instrucoes passo a passo exibido na propria ferramenta Thunderbird, com
  as opcoes de Pastas Locais e ImportExportTools NG.
- `IMAPtoMbox.pl` passou a usar streaming, filtros `-a`/`-b`, prefixo `-k` e nomes
  sanitizados para Windows; validado com servidor IMAP simulado (uma e duas mensagens).
- Filtros de data inicial/final adicionados tambem ao `imap_to_maildir.pl`; caminho
  `getDatedMsgList` corrigido para ler o campo de tamanho corretamente.

## Bugs conhecidos / atenção

- Senhas contendo `/` quebram o formato `host/usuário/senha` dos scripts Perl.
- `imapPing.pl` imprime linhas de debug (`opt_h`, `opt_p`, `opt_u`) no stdout; isso e
  comportamento do script original.
- A barra de progresso depende da versão do script e dos padroes em
  `src/main/executor.js`.
- `safeStorage` pode não estar disponivel em alguns ambientes Linux; nesse caso as
  senhas usam ofuscacao base64.
- O instalador NSIS foi gerado via Wine, mas ainda precisa ser validado em Windows
  nativo. Nao ha assinatura digital; o SmartScreen pode exibir aviso.
- `imapPing.pl` termina com codigo 0 mesmo quando a conexão falha; o executor detecta
  mensagens como "Error connecting to" para marcar o status como Falha.
- `getComputedStyle` do Bulma 1.x aplica tema escuro automático; o app forca
  `data-theme="light"` no `<html>`.

## Proximo passo

1. Testar cada ferramenta com uma conta IMAP de teste (ping, listar pastas, copiar uma
   pasta pequena, sync em modo `-t`, purge em pasta descartavel).
2. Testar o instalador NSIS em Windows sem Perl instalado e confirmar que
   `resources/scripts` e `resources/strawberry` sao encontrados.
3. Opcional: adicionar agendamento, múltiplos perfis de conta e exportacao de logs.
