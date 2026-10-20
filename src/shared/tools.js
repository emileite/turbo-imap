'use strict';

const CATEGORIES = {
  migration: {
    title: 'Migração e Sincronização',
    short: 'Migração',
    color: '#00aff0'
  },
  backup: {
    title: 'Backup, Exportação e Importação',
    short: 'Backup e conversão',
    color: '#7fba00'
  },
  maintenance: {
    title: 'Limpeza e Manutenção',
    short: 'Limpeza',
    color: '#f25022'
  },
  audit: {
    title: 'Auditoria, Diagnóstico e Informação',
    short: 'Auditoria e diagnóstico',
    color: '#8b5cf6'
  }
};

function withCategory(category, tool) {
  const meta = CATEGORIES[category];
  return {
    ...tool,
    category,
    categoryTitle: meta.title,
    categoryShort: meta.short,
    categoryColor: meta.color,
    accent: tool.accent || meta.color
  };
}

const RESUME_DISABLED = {
  default: false,
  flag: null,
  label: 'Continuar de onde parou (Resume)',
  note: 'Esta ferramenta não oferece retomada incremental.'
};

const RESUME_NATURAL = {
  default: true,
  flag: null,
  label: 'Continuar de onde parou (Resume)',
  note: 'A ferramenta compara origem e destino a cada execução.'
};

const TOOLS = [
  withCategory('migration', {
    id: 'imapcopy',
    script: 'imapcopy.pl',
    title: 'Copiar IMAP para IMAP',
    shortTitle: 'Copiar mensagens',
    badge: 'C',
    description:
      'Copia mensagens e pastas de uma conta IMAP para outra, com controle de duplicatas, filtros de data e modo de atualização.',
    notes:
      'O progresso é exibido a cada mensagem copiada. Use o modo Resume (-U) para não copiar mensagens que já existem no destino.',
    source: true,
    destination: true,
    sourceFlag: '-S',
    destFlag: '-D',
    resume: {
      default: true,
      flag: '-U',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -U: não copia mensagens que já existem no destino.'
    },
    baseArgs: ['-j', '1'],
    fields: [
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent, Drafts',
        help: 'Lista separada por vírgulas. Em branco copia todas as pastas.'
      },
      {
        key: 'recursive',
        label: 'Incluir subpastas das caixas informadas (-R)',
        type: 'checkbox',
        flag: '-R'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas',
        type: 'text',
        flag: '-e',
        placeholder: 'Trash, Junk',
        help: 'Correspondência exata dos nomes informados.'
      },
      {
        key: 'since',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024'
      },
      {
        key: 'before',
        label: 'Data final',
        type: 'text',
        flag: '-b',
        placeholder: '31-Dec-2024'
      },
      {
        key: 'maxSize',
        label: 'Tamanho máximo por mensagem (MB)',
        type: 'number',
        flag: '-X',
        min: 1,
        placeholder: '25'
      },
      {
        key: 'removeFromSource',
        label: 'Remover mensagens da origem depois de copiar (-C)',
        type: 'checkbox',
        flag: '-C',
        danger: true
      },
      {
        key: 'skipUnread',
        label: 'Não copiar mensagens não lidas (-u)',
        type: 'checkbox',
        flag: '-u'
      },
      {
        key: 'markSeen',
        label: 'Marcar mensagens copiadas como lidas (-v)',
        type: 'checkbox',
        flag: '-v'
      },
      {
        key: 'headersOnly',
        label: 'Copiar somente cabeçalhos (-H)',
        type: 'checkbox',
        flag: '-H'
      },
      {
        key: 'dontCopyDups',
        label: 'Ignorar duplicatas na origem (-l)',
        type: 'checkbox',
        flag: '-l'
      },
      {
        key: 'gmailSource',
        label: 'Origem é Gmail: remover prefixo [Gmail] (-G)',
        type: 'checkbox',
        flag: '-G'
      },
      {
        key: 'customFlags',
        label: 'Copiar flags personalizadas (-T)',
        type: 'checkbox',
        flag: '-T'
      },
      {
        key: 'skipDeleted',
        label: 'Não copiar mensagens marcadas para exclusão (-P)',
        type: 'checkbox',
        flag: '-P'
      }
    ]
  }),

  withCategory('migration', {
    id: 'imapsync',
    script: 'imapsync.pl',
    title: 'Sincronizar contas IMAP',
    shortTitle: 'Sincronizar',
    badge: 'S',
    description:
      'Sincroniza duas contas IMAP: adiciona mensagens ausentes no destino, remove as que não existem na origem e iguala as flags.',
    notes:
      'A sincronização é naturalmente idempotente: executar novamente continua de onde parou. Use o modo de teste para simular sem alterar nada.',
    source: true,
    destination: true,
    sourceFlag: '-S',
    destFlag: '-D',
    resume: RESUME_NATURAL,
    baseArgs: [],
    fields: [
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent',
        help: 'Em branco sincroniza todas as pastas.'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas',
        type: 'text',
        flag: '-e',
        placeholder: 'Trash, Junk'
      },
      {
        key: 'syncSince',
        label: 'Data inicial',
        type: 'text',
        flag: '-s',
        placeholder: '01-Jan-2024 ou 30'
      },
      {
        key: 'noDeletes',
        label: 'Não excluir mensagens do destino (-n)',
        type: 'checkbox',
        flag: '-n'
      },
      {
        key: 'trimSpaces',
        label: 'Colapsar espaços nos nomes das pastas (-R)',
        type: 'checkbox',
        flag: '-R'
      },
      {
        key: 'testOnly',
        label: 'Modo de teste: não alterar nada (-t)',
        type: 'checkbox',
        flag: '-t'
      }
    ]
  }),

  withCategory('migration', {
    id: 'migrateIMAP',
    script: 'migrateIMAP.pl',
    title: 'Migração estrutural de contas',
    shortTitle: 'Migrar estrutura',
    badge: 'M',
    description:
      'Migra contas inteiras entre servidores, com mapeamento de nomes de pastas e controle da estrutura do destino.',
    notes:
      'As credenciais de origem e destino do formulário são usadas para gerar a lista de usuários exigida pelo script. Uma execução padrão migra um único usuário.',
    source: true,
    destination: true,
    special: 'migrateIMAP',
    resume: {
      default: true,
      flag: '-U',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -U: não recopia mensagens que já existem no destino.'
    },
    baseArgs: [],
    fields: [
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas',
        type: 'text',
        flag: '-E',
        placeholder: 'Trash, Junk'
      },
      {
        key: 'excludeRegex',
        label: 'Excluir caixas por expressão regular',
        type: 'text',
        flag: '-R',
        placeholder: 'Trash|Junk|^Test'
      },
      {
        key: 'mailboxMap',
        label: 'Arquivo de mapeamento de pastas',
        type: 'text',
        flag: '-M',
        placeholder: 'Caminho para o arquivo de mapa'
      },
      {
        key: 'rootMailbox',
        label: 'Pasta raiz no destino',
        type: 'text',
        flag: '-p',
        placeholder: 'Migração'
      },
      {
        key: 'since',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024'
      },
      {
        key: 'before',
        label: 'Data final',
        type: 'text',
        flag: '-b',
        placeholder: '31-Dec-2024'
      },
      {
        key: 'onlyUnseen',
        label: 'Migrar somente mensagens não lidas (-u)',
        type: 'checkbox',
        flag: '-u'
      },
      {
        key: 'onlySeen',
        label: 'Migrar somente mensagens lidas (-o)',
        type: 'checkbox',
        flag: '-o'
      },
      {
        key: 'deleteFromSource',
        label: 'Remover da origem após copiar (-Y)',
        type: 'checkbox',
        flag: '-Y',
        danger: true
      },
      {
        key: 'deleteFromDest',
        label: 'Remover do destino o que não existe na origem (-X)',
        type: 'checkbox',
        flag: '-X',
        danger: true
      },
      {
        key: 'customFlags',
        label: 'Copiar flags personalizadas (-T)',
        type: 'checkbox',
        flag: '-T'
      },
      {
        key: 'maxSize',
        label: 'Tamanho máximo por mensagem (MB)',
        type: 'number',
        flag: '-s',
        min: 1,
        placeholder: '25'
      },
      {
        key: 'maxChildren',
        label: 'Processos simultâneos',
        type: 'number',
        flag: '-n',
        min: 1,
        placeholder: '2'
      },
      {
        key: 'timeout',
        label: 'Timeout em segundos',
        type: 'number',
        flag: '-t',
        min: 1,
        placeholder: '300'
      }
    ]
  }),

  withCategory('migration', {
    id: 'pop3toimap',
    script: 'pop3toimap.pl',
    title: 'Migrar POP3 para IMAP',
    shortTitle: 'POP3 para IMAP',
    badge: 'P',
    description:
      'Conecta em um servidor POP3 antigo, baixa as mensagens e as envia para uma conta IMAP moderna.',
    notes:
      'Informe as credenciais POP3 na origem e as credenciais IMAP no destino. O script mantém um log próprio em pop3toimap.log.',
    source: true,
    destination: true,
    sourceFlag: '-p',
    destFlag: '-i',
    sourceLabel: 'POP3',
    sourceHostLabel: 'Servidor POP3',
    sourceUserLabel: 'Usuário POP3',
    sourcePassLabel: 'Senha POP3',
    destinationLabel: 'IMAP de destino',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'mailbox',
        label: 'Pasta IMAP de destino',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX'
      },
      {
        key: 'range',
        label: 'Intervalo de mensagens POP3',
        type: 'text',
        flag: '-R',
        placeholder: '1:1000'
      },
      {
        key: 'timeout',
        label: 'Timeout em segundos',
        type: 'number',
        flag: '-t',
        min: 1,
        placeholder: '45'
      },
      {
        key: 'notify',
        label: 'E-mail para notificação',
        type: 'text',
        flag: '-n',
        placeholder: 'admin@exemplo.com'
      },
      {
        key: 'deleteAfter',
        label: 'Remover mensagens do POP3 após migrar (-r)',
        type: 'checkbox',
        flag: '-r',
        danger: true
      }
    ]
  }),

  withCategory('migration', {
    id: 'mbxIMAPsync',
    script: 'mbxIMAPsync.pl',
    title: 'Sincronizar Mbox local com IMAP',
    shortTitle: 'Mbox para IMAP',
    badge: 'B',
    description:
      'Sincroniza um arquivo local Mbox com uma pasta IMAP, adicionando e removendo mensagens para refletir o arquivo.',
    notes:
      'A sincronização é feita comparando Message-IDs, portanto pode ser executada novamente para manter o servidor alinhado ao arquivo local.',
    source: false,
    destination: true,
    destFlag: '-i',
    destinationLabel: 'IMAP de destino',
    resume: RESUME_NATURAL,
    baseArgs: [],
    fields: [
      {
        key: 'mailfile',
        label: 'Arquivo Mbox local',
        type: 'text',
        flag: '-f',
        placeholder: '/caminho/para/mailfile',
        required: true
      },
      {
        key: 'mailbox',
        label: 'Pasta IMAP',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX',
        required: true
      },
      {
        key: 'msgsPerFolder',
        label: 'Limite de mensagens por pasta',
        type: 'number',
        flag: '-F',
        min: 1,
        placeholder: 'Sem limite'
      }
    ]
  }),

  withCategory('backup', {
    id: 'IMAPtoMbox',
    script: 'IMAPtoMbox.pl',
    title: 'Backup IMAP para Mbox',
    shortTitle: 'IMAP para Mbox',
    badge: 'M',
    description:
      'Baixa os e-mails do servidor IMAP e salva um arquivo Mbox por pasta no computador local.',
    notes:
      'O modo Resume adiciona -n e evita copiar mensagens que já existem no arquivo Mbox de destino.',
    source: true,
    destination: false,
    sourceFlag: '-i',
    resume: {
      default: true,
      flag: '-n',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -n: não copia mensagens que já existem no Mbox.'
    },
    baseArgs: [],
    fields: [
      {
        key: 'outputDir',
        label: 'Diretório de destino',
        type: 'text',
        flag: '-m',
        placeholder: '/caminho/para/backup',
        required: true,
        help: 'Os arquivos Mbox serão criados neste diretório.'
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-M',
        placeholder: 'INBOX, Sent',
        help: 'Atenção: neste script a lista de pastas usa -M.'
      },
      {
        key: 'recursive',
        label: 'Incluir subpastas (-r)',
        type: 'checkbox',
        flag: '-r'
      },
      {
        key: 'filePrefix',
        label: 'Prefixo dos arquivos Mbox',
        type: 'text',
        flag: '-k',
        placeholder: 'TurboIMAP-',
        help: 'Ajuda a evitar sobrescrita e identifica os arquivos no Thunderbird.'
      },
      {
        key: 'dateFrom',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024',
        help: 'Opcional. Formato DD-MMM-YYYY; inclui mensagens a partir desta data.'
      },
      {
        key: 'dateTo',
        label: 'Data final',
        type: 'text',
        flag: '-b',
        placeholder: '31-Dec-2024',
        help: 'Opcional. Formato DD-MMM-YYYY; inclui mensagens até esta data.'
      },
      {
        key: 'owner',
        label: 'Usuário proprietário dos arquivos',
        type: 'text',
        flag: '-o',
        placeholder: 'usuario'
      }
    ]
  }),

  withCategory('backup', {
    id: 'MboxtoIMAP',
    script: 'MboxtoIMAP.pl',
    title: 'Importar Mbox para IMAP',
    shortTitle: 'Mbox para IMAP',
    badge: 'I',
    description:
      'Lê arquivos Mbox locais e envia as mensagens para uma conta IMAP.',
    notes:
      'Informe um diretório de mailfiles (-m) ou um arquivo individual (-f). Para um arquivo individual, informe também o nome da pasta IMAP (-n).',
    source: false,
    destination: true,
    destFlag: '-i',
    destinationLabel: 'IMAP de destino',
    resume: {
      default: false,
      flag: null,
      label: 'Continuar de onde parou (Resume)',
      note: 'O script não compara duplicatas. Use -R para remover do arquivo após o envio.'
    },
    baseArgs: [],
    requiredOneOf: {
      keys: ['mailfileDir', 'mailfile'],
      message: 'Informe o diretório de mailfiles ou um arquivo individual.'
    },
    fields: [
      {
        key: 'mailfileDir',
        label: 'Diretório de mailfiles',
        type: 'text',
        flag: '-m',
        placeholder: '/caminho/para/mailfiles'
      },
      {
        key: 'mailfile',
        label: 'Arquivo Mbox individual',
        type: 'text',
        flag: '-f',
        placeholder: '/caminho/para/arquivo'
      },
      {
        key: 'mailboxName',
        label: 'Pasta IMAP para arquivo individual',
        type: 'text',
        flag: '-n',
        placeholder: 'INBOX'
      },
      {
        key: 'rootMailbox',
        label: 'Pasta raiz no destino',
        type: 'text',
        flag: '-p',
        placeholder: 'Importados'
      },
      {
        key: 'range',
        label: 'Intervalo de mensagens',
        type: 'text',
        flag: '-r',
        placeholder: '1-100'
      },
      {
        key: 'removeAfter',
        label: 'Remover mensagens do arquivo após enviar (-R)',
        type: 'checkbox',
        flag: '-R',
        danger: true
      }
    ]
  }),

  withCategory('backup', {
    id: 'imap_to_maildir',
    script: 'imap_to_maildir.pl',
    title: 'Backup IMAP para Maildir',
    shortTitle: 'IMAP para Maildir',
    badge: 'D',
    description:
      'Faz backup dos e-mails do servidor IMAP no formato Maildir, com um arquivo individual para cada mensagem.',
    notes:
      'O usuário do Maildir é preenchido com o usuário da origem quando o campo específico fica em branco.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'maildir',
        label: 'Diretório Maildir',
        type: 'text',
        flag: '-M',
        placeholder: '/caminho/para/Maildir',
        required: true
      },
      {
        key: 'maildirUser',
        label: 'Usuário do Maildir',
        type: 'text',
        flag: '-u',
        noFlag: true,
        placeholder: 'mesmo usuário da origem'
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas (regex)',
        type: 'text',
        flag: '-e',
        placeholder: 'Trash|Junk'
      },
      {
        key: 'since',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024',
        help: 'Opcional. Inclui mensagens a partir desta data.'
      },
      {
        key: 'before',
        label: 'Data final',
        type: 'text',
        flag: '-b',
        placeholder: '31-Dec-2024',
        help: 'Opcional. Inclui mensagens até esta data.'
      },
      {
        key: 'gmailSource',
        label: 'Origem é Gmail: remover prefixo [Gmail] (-G)',
        type: 'checkbox',
        flag: '-G'
      }
    ]
  }),

  withCategory('backup', {
    id: 'maildir_to_imap',
    script: 'maildir_to_imap.pl',
    title: 'Importar Maildir para IMAP',
    shortTitle: 'Maildir para IMAP',
    badge: 'U',
    description:
      'Lê uma estrutura Maildir local e envia os e-mails para uma conta IMAP.',
    notes:
      'As credenciais do destino e o caminho do Maildir são usados para gerar o arquivo de usuários exigido pelo script.',
    source: false,
    destination: true,
    special: 'maildirToIMAP',
    destinationLabel: 'IMAP de destino',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'maildir',
        label: 'Diretório Maildir local',
        type: 'text',
        noFlag: true,
        placeholder: '/caminho/para/Maildir',
        required: true
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'mailboxMap',
        label: 'Mapeamento de pastas',
        type: 'text',
        flag: '-M',
        placeholder: 'Sent:Enviados, Drafts:Rascunhos'
      },
      {
        key: 'maxChildren',
        label: 'Processos simultâneos',
        type: 'number',
        flag: '-n',
        min: 1,
        placeholder: '1'
      },
      {
        key: 'timeout',
        label: 'Timeout em segundos',
        type: 'number',
        flag: '-t',
        min: 1,
        placeholder: '45'
      }
    ]
  }),

  withCategory('backup', {
    id: 'thunderbird_to_imap',
    script: 'thunderbird_to_imap.pl',
    title: 'Importar perfil Thunderbird',
    shortTitle: 'Thunderbird para IMAP',
    badge: 'T',
    description:
      'Lê a estrutura de arquivos de um perfil do Mozilla Thunderbird e envia os e-mails para um servidor IMAP.',
    notes:
      'Informe a pasta raiz do perfil local. O modo Resume adiciona -U para evitar duplicatas no destino.',
    source: false,
    destination: true,
    destFlag: '-i',
    destinationLabel: 'IMAP de destino',
    resume: {
      default: true,
      flag: '-U',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -U: não copia mensagens duplicadas.'
    },
    baseArgs: [],
    fields: [
      {
        key: 'profileDir',
        label: 'Pasta raiz do perfil Thunderbird',
        type: 'text',
        flag: '-m',
        placeholder: '/caminho/para/perfil',
        required: true
      },
      {
        key: 'folders',
        label: 'Pastas a importar',
        type: 'text',
        flag: '-M',
        placeholder: 'Inbox, Sent'
      },
      {
        key: 'excludeFolders',
        label: 'Pastas a excluir',
        type: 'text',
        flag: '-E',
        placeholder: 'Trash, Junk'
      },
      {
        key: 'range',
        label: 'Intervalo de mensagens',
        type: 'text',
        flag: '-R',
        placeholder: '1:1000'
      },
      {
        key: 'rootMailbox',
        label: 'Pasta raiz no destino',
        type: 'text',
        flag: '-r',
        placeholder: 'Thunderbird'
      },
      {
        key: 'wrapLines',
        label: 'Corrigir terminadores de linha do Thunderbird (-W)',
        type: 'checkbox',
        flag: '-W'
      }
    ]
  }),

  withCategory('backup', {
    id: 'imapdump',
    script: 'imapdump.pl',
    title: 'Dump da estrutura IMAP',
    shortTitle: 'Dump IMAP',
    badge: 'D',
    description:
      'Despeja a estrutura bruta do IMAP e as mensagens em disco para backup ou restauração posterior.',
    notes:
      'Use em conjunto com o Importar dump IMAP (dumptoIMAP.pl). O modo Resume adiciona -U para ignorar mensagens já presentes no diretório.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: {
      default: true,
      flag: '-U',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -U: não despeja mensagens que já existem no diretório.'
    },
    baseArgs: [],
    fields: [
      {
        key: 'outputDir',
        label: 'Diretório do dump',
        type: 'text',
        flag: '-f',
        placeholder: '/caminho/para/dump',
        required: true
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas',
        type: 'text',
        flag: '-e',
        placeholder: 'Trash, Junk'
      },
      {
        key: 'excludeRegex',
        label: 'Excluir caixas (regex)',
        type: 'text',
        flag: '-E',
        placeholder: 'Trash|Junk'
      },
      {
        key: 'since',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024'
      },
      {
        key: 'extension',
        label: 'Extensão dos arquivos',
        type: 'text',
        flag: '-x',
        placeholder: 'eml'
      },
      {
        key: 'imapSearch',
        label: 'Filtro IMAP SEARCH',
        type: 'text',
        flag: '-Z',
        placeholder: 'SUBJECT "fatura"'
      },
      {
        key: 'summaryFile',
        label: 'Arquivo de resumo',
        type: 'text',
        flag: '-T',
        placeholder: '/caminho/para/resumo.txt'
      },
      {
        key: 'attachments',
        label: 'Extrair anexos separadamente (-g)',
        type: 'checkbox',
        flag: '-g'
      },
      {
        key: 'onlyAttachments',
        label: 'Extrair somente anexos (-G)',
        type: 'checkbox',
        flag: '-G'
      },
      {
        key: 'includeFlags',
        label: 'Incluir Seen/Unseen no nome do arquivo (-s)',
        type: 'checkbox',
        flag: '-s'
      },
      {
        key: 'setFileDate',
        label: 'Usar a data do cabeçalho no arquivo (-Y)',
        type: 'checkbox',
        flag: '-Y'
      },
      {
        key: 'noSizePrompt',
        label: 'Não perguntar sobre o cálculo de tamanho (-q)',
        type: 'checkbox',
        flag: '-q',
        default: true,
        help: 'Recomendado para execução pela interface.'
      },
      {
        key: 'removeAfter',
        label: 'Remover mensagens após o dump (-r)',
        type: 'checkbox',
        flag: '-r',
        danger: true
      }
    ]
  }),

  withCategory('backup', {
    id: 'dumptoIMAP',
    script: 'dumptoIMAP.pl',
    title: 'Importar dump IMAP',
    shortTitle: 'Importar dump',
    badge: 'R',
    description:
      'Restaura para o servidor IMAP uma estrutura de mensagens criada previamente pelo imapdump.pl.',
    notes: 'Informe o mesmo diretório de dump usado na exportação.',
    source: false,
    destination: true,
    destFlag: '-i',
    destinationLabel: 'IMAP de destino',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'dumpDir',
        label: 'Diretório do dump',
        type: 'text',
        flag: '-D',
        placeholder: '/caminho/para/dump',
        required: true
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'extension',
        label: 'Importar somente esta extensão',
        type: 'text',
        flag: '-x',
        placeholder: 'eml'
      },
      {
        key: 'rootMailbox',
        label: 'Pasta raiz no destino',
        type: 'text',
        flag: '-r',
        placeholder: 'Restaurados'
      }
    ]
  }),

  withCategory('backup', {
    id: 'imapToThunderbird',
    script: 'IMAPtoMbox.pl',
    title: 'Backup IMAP para Thunderbird',
    shortTitle: 'IMAP para Thunderbird',
    badge: 'T',
    description:
      'Exporta cada pasta IMAP como um arquivo Mbox no formato usado pelo Thunderbird, pronto para abrir ou importar no aplicativo.',
    notes:
      'Para abrir direto no Thunderbird, feche o Thunderbird e use como destino a pasta Mail/Local Folders do perfil; as pastas aparecerão com o prefixo informado. Como alternativa, importe os arquivos Mbox com a extensão ImportExportTools NG.',
    source: true,
    destination: false,
    sourceFlag: '-i',
    guide: 'thunderbird',
    resume: {
      default: true,
      flag: '-n',
      label: 'Continuar de onde parou (Resume)',
      note: 'Adiciona -n: não copia mensagens que já existem no arquivo Mbox.'
    },
    baseArgs: [],
    fields: [
      {
        key: 'outputDir',
        label: 'Pasta de destino',
        type: 'text',
        flag: '-m',
        placeholder: 'C:\\Users\\nome\\AppData\\Roaming\\Thunderbird\\Profiles\\...\\Mail\\Local Folders',
        required: true,
        help: 'Para abrir no Thunderbird, selecione Mail/Local Folders do perfil. Feche o Thunderbird antes.'
      },
      {
        key: 'filePrefix',
        label: 'Prefixo das pastas/arquivos',
        type: 'text',
        flag: '-k',
        placeholder: 'TurboIMAP-',
        default: 'TurboIMAP-',
        help: 'Evita conflito com pastas existentes. As pastas no Thunderbird terão este prefixo.'
      },
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-M',
        placeholder: 'INBOX, Sent',
        help: 'Em branco exporta todas as pastas.'
      },
      {
        key: 'recursive',
        label: 'Incluir subpastas (-r)',
        type: 'checkbox',
        flag: '-r'
      },
      {
        key: 'dateFrom',
        label: 'Data inicial',
        type: 'text',
        flag: '-a',
        placeholder: '01-Jan-2024',
        help: 'Opcional. Formato DD-MMM-YYYY; inclui mensagens a partir desta data.'
      },
      {
        key: 'dateTo',
        label: 'Data final',
        type: 'text',
        flag: '-b',
        placeholder: '31-Dec-2024',
        help: 'Opcional. Formato DD-MMM-YYYY; inclui mensagens até esta data.'
      }
    ]
  }),

  withCategory('maintenance', {
    id: 'delIMAPdups',
    script: 'delIMAPdups.pl',
    title: 'Remover mensagens duplicadas',
    shortTitle: 'Remover duplicatas',
    badge: 'D',
    description:
      'Localiza mensagens duplicadas em uma conta IMAP e pode movê-las ou purgá-las.',
    notes:
      'Sem a opção de purga o script apenas informa o que faria. A purga é permanente: revise as opções antes de executar.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX',
        help: 'Em branco examina todas as pastas.'
      },
      {
        key: 'recursive',
        label: 'Incluir subpastas (-R)',
        type: 'checkbox',
        flag: '-R'
      },
      {
        key: 'purge',
        label: 'Purgar duplicatas de verdade (-p)',
        type: 'checkbox',
        flag: '-p',
        danger: true
      },
      {
        key: 'moveTo',
        label: 'Mover duplicatas para a pasta',
        type: 'text',
        flag: '-M',
        placeholder: 'Duplicates'
      },
      {
        key: 'useDate',
        label: 'Incluir a data na chave de unicidade (-u)',
        type: 'checkbox',
        flag: '-u'
      },
      {
        key: 'useMd5',
        label: 'Usar hash MD5 do corpo da mensagem (-H)',
        type: 'checkbox',
        flag: '-H'
      },
      {
        key: 'keyField',
        label: 'Campo para determinar duplicidade',
        type: 'text',
        flag: '-F',
        placeholder: 'Message-ID'
      },
      {
        key: 'range',
        label: 'Intervalo de mensagens',
        type: 'text',
        flag: '-r',
        placeholder: '1:1000'
      }
    ]
  }),

  withCategory('maintenance', {
    id: 'delete_imap_mailboxes',
    script: 'delete_imap_mailboxes.pl',
    title: 'Excluir pastas em massa',
    shortTitle: 'Excluir pastas',
    badge: 'X',
    description:
      'Exclui em massa pastas de uma conta IMAP com base em uma expressão regular.',
    notes:
      'O modo de teste vem ativado por padrão. Desmarque a opção para realmente excluir as pastas correspondentes.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'mailboxRegex',
        label: 'Expressão regular das pastas',
        type: 'text',
        flag: '-m',
        placeholder: '^Teste|Temp',
        required: true,
        help: 'Exemplo: ^Teste exclui todas as pastas que começam com Teste.'
      },
      {
        key: 'testMode',
        label: 'Modo de teste: apenas mostrar o que seria excluído (-t)',
        type: 'checkbox',
        flag: '-t',
        default: true
      },
      {
        key: 'dontPurgeInbox',
        label: 'Nunca excluir a INBOX (-P)',
        type: 'checkbox',
        flag: '-P',
        default: true
      }
    ]
  }),

  withCategory('maintenance', {
    id: 'purgeMbx',
    script: 'purgeMbx.pl',
    title: 'Limpar uma pasta',
    shortTitle: 'Limpar pasta',
    badge: 'L',
    description:
      'Marca todas as mensagens de uma pasta IMAP como excluídas e executa o expunge.',
    notes: 'Esta operação remove definitivamente as mensagens da pasta informada.',
    source: true,
    destination: false,
    sourceFlag: '-s',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'mailbox',
        label: 'Pasta a limpar',
        type: 'text',
        flag: '-m',
        placeholder: 'Trash',
        required: true,
        help: 'Obrigatório. Todas as mensagens desta pasta serão removidas.'
      }
    ]
  }),

  withCategory('maintenance', {
    id: 'trash',
    script: 'trash.pl',
    title: 'Gerenciar a lixeira',
    shortTitle: 'Lixeira',
    badge: 'T',
    description:
      'Gerencia, limpa ou esvazia a lixeira da conta de e-mail de forma automatizada.',
    notes:
      'A opção de esvaziar a lixeira é destrutiva. Sem ela, o script apenas processa a pasta configurada como lixeira.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'trashMailbox',
        label: 'Nome da pasta da lixeira',
        type: 'text',
        flag: '-t',
        placeholder: 'Trash'
      },
      {
        key: 'emptyTrash',
        label: 'Esvaziar a lixeira (-e)',
        type: 'checkbox',
        flag: '-e',
        danger: true
      },
      {
        key: 'mailboxes',
        label: 'Limitar a estas caixas',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'verbose',
        label: 'Modo detalhado (-v)',
        type: 'checkbox',
        flag: '-v'
      }
    ]
  }),

  withCategory('maintenance', {
    id: 'imapfilter',
    script: 'imapfilter.pl',
    title: 'Aplicar filtros no servidor',
    shortTitle: 'Filtros IMAP',
    badge: 'F',
    description:
      'Aplica regras de filtro nas mensagens do servidor, movendo ou excluindo com base em remetente, assunto e outros critérios.',
    notes:
      'O arquivo de regras é criado fora do aplicativo. O modo de teste vem ativado por padrão para evitar alterações acidentais.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'rulesFile',
        label: 'Arquivo de regras',
        type: 'text',
        flag: '-r',
        placeholder: '/caminho/para/regras.txt',
        required: true,
        help: 'Arquivo local com as regras do imapfilter.pl.'
      },
      {
        key: 'testMode',
        label: 'Modo de teste: não mover mensagens (-t)',
        type: 'checkbox',
        flag: '-t',
        default: true
      },
      {
        key: 'trashMailbox',
        label: 'Pasta de lixeira para expurgo',
        type: 'text',
        flag: '-X',
        placeholder: 'Trash'
      },
      {
        key: 'chunkSize',
        label: 'Mensagens processadas por vez',
        type: 'number',
        flag: '-c',
        min: 1,
        placeholder: '500'
      }
    ]
  }),

  withCategory('audit', {
    id: 'list_account_sizes',
    script: 'list_account_sizes.pl',
    title: 'Tamanho das contas',
    shortTitle: 'Tamanhos',
    badge: 'T',
    description:
      'Calcula o tamanho total da conta e de cada pasta, gerando um relatório no diretório de dados.',
    notes:
      'O relatório completo também é gravado em list_account_sizes.report na pasta de dados.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'brief',
        label: 'Relatório resumido (-B)',
        type: 'checkbox',
        flag: '-B'
      },
      {
        key: 'noQuota',
        label: 'Não usar a extensão QUOTA do servidor (-N)',
        type: 'checkbox',
        flag: '-N'
      }
    ]
  }),

  withCategory('audit', {
    id: 'list_imap_folders',
    script: 'list_imap_folders.pl',
    title: 'Listar pastas e mensagens',
    shortTitle: 'Listar pastas',
    badge: 'P',
    description:
      'Lista as pastas de uma conta IMAP com a quantidade de mensagens e o tamanho de cada uma.',
    notes:
      'A saída detalhada é exibida no painel de log. Use-a para escolher as pastas das outras ferramentas.',
    source: true,
    destination: false,
    sourceFlag: '-S',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'stats',
        label: 'Exibir estatísticas de tamanho (-s)',
        type: 'checkbox',
        flag: '-s'
      },
      {
        key: 'utf',
        label: 'Usar nomes de pastas em UTF-8 (-u)',
        type: 'checkbox',
        flag: '-u'
      },
      {
        key: 'largeThreshold',
        label: 'Destacar mensagens maiores que (bytes)',
        type: 'number',
        flag: '-U',
        min: 1,
        placeholder: '1048576'
      }
    ]
  }),

  withCategory('audit', {
    id: 'imap_audit',
    script: 'imap_audit.pl',
    title: 'Auditar duas contas IMAP',
    shortTitle: 'Auditoria',
    badge: 'A',
    description:
      'Compara origem e destino, verificando quantidade de mensagens, integridade das pastas e diferenças entre as contas.',
    notes:
      'Use o modo de contagem para uma verificação rápida ou remova essa opção para comparar mensagem por mensagem.',
    source: true,
    destination: true,
    sourceFlag: '-S',
    destFlag: '-D',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'mailboxes',
        label: 'Caixas de correio',
        type: 'text',
        flag: '-m',
        placeholder: 'INBOX, Sent'
      },
      {
        key: 'exclude',
        label: 'Excluir caixas',
        type: 'text',
        flag: '-e',
        placeholder: 'Trash, Junk'
      },
      {
        key: 'onlyCounts',
        label: 'Comparar somente a quantidade de mensagens (-n)',
        type: 'checkbox',
        flag: '-n'
      },
      {
        key: 'before',
        label: 'Data final',
        type: 'text',
        flag: '-B',
        placeholder: '31-Dec-2024'
      },
      {
        key: 'after',
        label: 'Data inicial',
        type: 'text',
        flag: '-A',
        placeholder: '01-Jan-2024'
      }
    ]
  }),

  withCategory('audit', {
    id: 'imap_search',
    script: 'imap_search.pl',
    title: 'Busca avançada no IMAP',
    shortTitle: 'Busca IMAP',
    badge: 'S',
    description:
      'Realiza buscas complexas diretamente no servidor IMAP, sem baixar as mensagens para o computador.',
    notes:
      'Informe os critérios no formato campo=valor, separados por ponto e vírgula ou quebra de linha.',
    source: true,
    destination: false,
    special: 'imapSearch',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'criteria',
        label: 'Critérios de busca',
        type: 'textarea',
        noFlag: true,
        rows: 4,
        required: true,
        placeholder: 'from=financeiro@exemplo.com; subject=fatura; since=01-Jan-2024',
        help: 'Exemplos de campos: from, to, subject, body, since, before, larger, smaller.'
      }
    ]
  }),

  withCategory('audit', {
    id: 'imapPing',
    script: 'imapPing.pl',
    title: 'Testar conexão IMAP',
    shortTitle: 'Testar conexão',
    badge: 'K',
    description:
      'Valida host, usuário e senha e mede o tempo das operações básicas de IMAP.',
    notes:
      'Use antes de iniciar uma cópia ou sincronização para confirmar as credenciais.',
    source: true,
    destination: false,
    credentialStyle: 'separate',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: []
  }),

  withCategory('audit', {
    id: 'imapCapability',
    script: 'imapCapability.pl',
    title: 'Recursos do servidor',
    shortTitle: 'Capabilities',
    badge: 'C',
    description:
      'Lista os recursos técnicos suportados pelo servidor, como IDLE, QUOTA, SSL e extensões IMAP.',
    notes:
      'Use a saída para diagnosticar compatibilidade antes de escolher uma ferramenta de migração.',
    source: true,
    destination: false,
    credentialStyle: 'separate',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: [
      {
        key: 'listMailboxes',
        label: 'Também listar as pastas (-m)',
        type: 'checkbox',
        flag: '-m'
      }
    ]
  }),

  withCategory('audit', {
    id: 'test_oauth2_login',
    script: 'test_oauth2_login.pl',
    title: 'Testar login OAuth2',
    shortTitle: 'Testar OAuth2',
    badge: 'O',
    description:
      'Testa autenticação moderna XOAUTH2 no Gmail, o mesmo fluxo usado por provedores como o Office 365 quando não aceitam senha comum.',
    notes:
      'O script testa imap.gmail.com:993. Informe o usuário e o token OAuth2; o servidor é fixo e não precisa ser preenchido.',
    source: true,
    destination: false,
    sourceHostHidden: true,
    sourceLabel: 'Gmail / OAuth2',
    sourceUserLabel: 'Usuário Gmail',
    sourcePassLabel: 'Token OAuth2',
    special: 'oauth2',
    resume: RESUME_DISABLED,
    baseArgs: [],
    fields: []
  })
];

function getTool(id) {
  return TOOLS.find((tool) => tool.id === id) || null;
}

function getPublicTools() {
  return JSON.parse(JSON.stringify(TOOLS));
}

function getCategories() {
  return Object.entries(CATEGORIES).map(([id, meta]) => ({ id, ...meta }));
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function assertNoSeparator(value, label) {
  if (String(value).includes('/')) {
    throw new Error(`${label} não pode conter "/" porque os scripts usam esse caractere como separador.`);
  }
  assertNoNewline(value, label);
}

function assertNoNewline(value, label) {
  if (/[\r\n]/.test(String(value))) {
    throw new Error(`${label} não pode conter quebras de linha.`);
  }
}

function requireAccount(account, label, options = {}) {
  const hostRequired = options.hostRequired !== false;
  const allowSlashInPass = options.allowSlashInPass === true;
  const host = clean(account && account.host);
  const user = clean(account && account.user);
  const pass = account && typeof account.pass === 'string' ? account.pass : '';

  if (hostRequired && !host) throw new Error(`Informe o servidor de ${label}.`);
  if (!user) throw new Error(`Informe o usuário de ${label}.`);
  if (!pass) throw new Error(`Informe a senha de ${label}.`);

  if (hostRequired) assertNoSeparator(host, `Servidor de ${label}`);
  assertNoSeparator(user, `Usuário de ${label}`);
  if (allowSlashInPass) {
    assertNoNewline(pass, `Senha de ${label}`);
  } else {
    assertNoSeparator(pass, `Senha de ${label}`);
  }

  return { host, user, pass };
}

function credential(account, label) {
  const data = requireAccount(account, label);
  return `${data.host}/${data.user}/${data.pass}`;
}

function isMeaningful(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function buildArgs(scriptName, values) {
  const tool = getTool(scriptName);
  if (!tool) throw new Error('Ferramenta desconhecida.');

  const source = (values && values.source) || {};
  const destination = (values && values.destination) || {};
  const options = (values && values.options) || {};
  const args = [];

  if (tool.special === 'migrateIMAP') {
    const src = requireAccount(source, 'origem', { allowSlashInPass: true });
    const dst = requireAccount(destination, 'destino', { allowSlashInPass: true });
    if (!options.__usersFile) throw new Error('Não foi possível preparar o arquivo de usuários.');
    args.push('-S', src.host, '-D', dst.host, '-i', options.__usersFile);
  } else if (tool.special === 'maildirToIMAP') {
    const dst = requireAccount(destination, 'destino', { allowSlashInPass: true });
    if (!options.__usersFile) throw new Error('Não foi possível preparar o arquivo de usuários.');
    args.push('-i', options.__usersFile, '-D', dst.host);
  } else if (tool.special === 'imapSearch') {
    const src = requireAccount(source, 'origem');
    args.push(`${src.host}/${src.user}/${src.pass}`);
  } else if (tool.special === 'oauth2') {
    const src = requireAccount(source, 'origem', { hostRequired: false, allowSlashInPass: true });
    args.push(src.user, src.pass);
  } else if (tool.credentialStyle === 'separate') {
    const src = requireAccount(source, 'origem', { allowSlashInPass: true });
    args.push('-h', src.host, '-u', src.user, '-p', src.pass);
  } else {
    if (tool.source && tool.sourceFlag) {
      args.push(tool.sourceFlag, credential(source, 'origem'));
    }
    if (tool.destination && tool.destFlag) {
      args.push(tool.destFlag, credential(destination, 'destino'));
    }
  }

  for (const field of tool.fields) {
    const raw = options[field.key];

    if (field.type === 'checkbox') {
      if (raw === true) args.push(field.flag);
      continue;
    }

    if (!isMeaningful(raw)) {
      if (field.required) throw new Error(`Preencha o campo "${field.label}".`);
      continue;
    }

    if (field.noFlag) continue;

    let value = String(raw).trim();
    if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) {
        throw new Error(`O campo "${field.label}" deve ser um número positivo.`);
      }
      if (field.min && number < field.min) {
        throw new Error(`O campo "${field.label}" deve ser maior ou igual a ${field.min}.`);
      }
      value = String(Math.trunc(number));
    }

    assertNoNewline(value, field.label);
    args.push(field.flag, value);
  }

  if (scriptName === 'imap_to_maildir') {
    const maildirUser = clean(options.maildirUser) || clean(source.user);
    if (!maildirUser) throw new Error('Informe o usuário do Maildir ou o usuário da origem.');
    args.push('-u', maildirUser);
  }

  if (scriptName === 'imap_search') {
    const criteria = String(options.criteria || '')
      .split(/[;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!criteria.length) throw new Error('Informe ao menos um critério de busca.');
    args.push(...criteria);
  }

  if (tool.requiredOneOf) {
    const satisfied = tool.requiredOneOf.keys.some((key) => isMeaningful(options[key]));
    if (!satisfied) throw new Error(tool.requiredOneOf.message);
  }

  if (tool.resume && tool.resume.flag && values && values.resume) {
    args.push(tool.resume.flag);
  }

  args.push(...tool.baseArgs);

  return args;
}

function redactArgs(args, values) {
  const secrets = [
    values && values.source && values.source.pass,
    values && values.destination && values.destination.pass
  ].filter((secret) => typeof secret === 'string' && secret.length > 0);

  return args.map((raw) => {
    const arg = String(raw);

    for (const secret of secrets) {
      if (arg.endsWith(`/${secret}`)) {
        return arg.slice(0, arg.length - secret.length) + '********';
      }
    }

    return secrets.includes(arg) ? '********' : arg;
  });
}

module.exports = {
  CATEGORIES,
  TOOLS,
  getTool,
  getPublicTools,
  getCategories,
  buildArgs,
  redactArgs
};
