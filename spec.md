# Turbo IMAP - Especificacoes do Projeto

## Repositório

<https://github.com/emileite/turbo-imap>

## Objetivo

Turbo IMAP e um aplicativo desktop Electron para Windows (com suporte de desenvolvimento
em Linux/macOS) que oferece uma interface grafica amigavel para a suite de scripts Perl
`rick-sanders-imap-tools`. A interface e localizada em ingles (padrao) e portugues do
Brasil, escolhido automaticamente conforme o idioma do sistema operacional.

## Escopo principal

- Interface grafica construida com Bulma CSS, com cores solidas e sem degradês.
- Internacionalizacao (i18n) com ingles como padrao e portugues quando o sistema estiver
  configurado em portugues; todos os labels, mensagens, ferramentas e dialogos sao
  traduzidos.
- Menu lateral agrupado em Migração e Sincronização, Backup/Exportação/Importação,
  Limpeza/Manutenção e Auditoria/Diagnóstico/Informação.
- Banco de dados SQLite local para armazenar credenciais e a última configuração de cada
  ferramenta.
- Execução dos scripts Perl em sub-processos (child_process.spawn).
- Captura de stdout/stderr, gravacao de logs completos e exibicao em tempo real.
- Extracao de progresso do stdout do Perl via expressoes regulares e envio ao renderer
  por IPC.
- Geracao de arquivos temporarios de usuarios para scripts que exigem lista de contas
  (`migrateIMAP.pl` e `maildir_to_imap.pl`), com remocao ao final da execucao.
- Arquivos de progresso persistentes em `progress/` para retomar execuções
  interrompidas quando a ferramenta suportar.
- Empacotamento com electron-builder (NSIS no Windows), com a pasta `scripts/` e o
  runtime portatil do Strawberry Perl distribuidos como `extraResources` (fora do ASAR).
- O instalador Windows nao depende de Perl instalado na maquina de destino.

## Ferramentas expostas na interface

O menu e dividido nas categorias Migração, Backup/Conversão, Limpeza e
Auditoria/Diagnóstico.

| Categoria | Scripts |
| --- | --- |
| Migração e Sincronização | `imapcopy.pl`, `imapsync.pl`, `migrateIMAP.pl`, `pop3toimap.pl`, `mbxIMAPsync.pl` |
| Backup, Exportação e Importação | `IMAPtoMbox.pl`, `MboxtoIMAP.pl`, `imap_to_maildir.pl`, `maildir_to_imap.pl`, `thunderbird_to_imap.pl`, `imapdump.pl`, `dumptoIMAP.pl` |
| Limpeza e Manutenção | `delIMAPdups.pl`, `delete_imap_mailboxes.pl`, `purgeMbx.pl`, `trash.pl`, `imapfilter.pl` |
| Auditoria, Diagnóstico e Informação | `list_account_sizes.pl`, `list_imap_folders.pl`, `imap_audit.pl`, `imap_search.pl`, `imapPing.pl`, `imapCapability.pl`, `test_oauth2_login.pl` |

## Requisitos funcionais

1. Splash screen exibida por 4 segundos enquanto o banco e inicializado.
2. Formulario dinamico por ferramenta, com credenciais de origem/destino, opções
   avancadas e checkbox "Continuar de onde parou (Resume)".
3. Ao selecionar uma ferramenta, carregar a última configuração salva no SQLite.
4. Exibir status da última execução: Sucesso, Falha, Interrompido ou Em execução.
5. Executar o script Perl, registrar log em `logs/<script>_<timestamp>.log` e emitir
   linhas de log, progresso e status para a interface.
6. Barra de progresso determinada quando o total de mensagens for conhecido e
   indeterminada caso contrario.
7. Salvar snapshots de progresso em `progress/<script>.json`.
8. Permitir interromper o processo em execução.
9. Exibir histórico resumido das últimas execuções e permitir abrir o log.
10. Rodape fixo: `Motor de processamento de e-mails alimentado por rick-sanders-imap-tools`.

## Requisitos não funcionais

- `contextIsolation: true`, `nodeIntegration: false` e preload com `contextBridge`.
- Senhas armazenadas com `safeStorage` do Electron quando disponivel (fallback base64
  local, com aviso no README).
- Nenhuma senha deve ser gravada nos logs; a linha de comando registrada e redigida.
- Validacao de argumentos no processo principal, sem aceitar flags arbitrarias do
  renderer.
- Dados graváveis (`logs/`, `progress/`, banco) ficam na raiz do projeto em
  desenvolvimento e em `userData` quando empacotado.

## Fora de escopo (MVP)

- Sincronização de múltiplos usuários em lote.
- Agendamento de execuções.
- Edicao/compilacao dos scripts Perl.
- Instalação do Strawberry Perl no sistema operacional (o build Windows inclui o runtime portatil).
