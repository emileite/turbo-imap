'use strict';

const api = window.turbo;

const state = {
  tools: [],
  system: null,
  activeTool: null,
  config: null,
  running: false,
  activeRun: null,
  history: [],
  logLineCount: 0,
  showPasswords: false,
  summary: createEmptySummary(),
  runStartedAt: null,
  runFinishedAt: null,
  durationTimer: null,
  logExpanded: false
};

const els = {};

let toastTimer = null;
let historyRequest = 0;

function $(id) {
  return document.getElementById(id);
}

function cacheElements() {
  const ids = [
    'tool-nav',
    'perl-indicator',
    'sidebar-hint',
    'connection-warning',
    'run-pill',
    'topbar-tool',
    'topbar-kicker',
    'hero',
    'hero-kicker',
    'hero-title',
    'hero-description',
    'hero-notes',
    'thunderbird-instructions',
    'last-status',
    'last-run-date',
    'tool-form',
    'source-host',
    'source-user',
    'source-pass',
    'source-column',
    'source-title',
    'source-host-field',
    'source-host-label',
    'source-user-label',
    'source-pass-label',
    'dest-title',
    'dest-host-label',
    'dest-user-label',
    'dest-pass-label',
    'dest-host',
    'dest-user',
    'dest-pass',
    'dest-column',
    'show-passwords',
    'resume',
    'resume-label',
    'resume-note',
    'options-fields',
    'options-hint',
    'btn-run',
    'btn-stop',
    'btn-save',
    'btn-open-logs',
    'btn-about',
    'btn-clear-log',
    'about-modal',
    'about-version',
    'about-runtime',
    'btn-open-repo',
    'run-state',
    'run-started',
    'progress-bar',
    'progress-label',
    'progress-percent',
    'summary-empty',
    'summary-content',
    'summary-messages-label',
    'summary-messages',
    'summary-folders',
    'summary-duration',
    'summary-result',
    'summary-message',
    'activity-list',
    'activity-empty',
    'btn-toggle-log',
    'toggle-log-label',
    'log-panel',
    'log-output',
    'autoscroll',
    'history-list',
    'toast'
  ];

  for (const id of ids) {
    els[id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = $(id);
  }
}

function formatDate(value) {
  if (!value) return 'Sem registros';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date);
}

function setTag(element, text, kind) {
  element.className = kind ? `tag is-${kind}` : 'tag is-light';
  element.textContent = text;
}

function statusKind(status) {
  switch (status) {
    case 'Sucesso':
      return 'success';
    case 'Falha':
      return 'danger';
    case 'Interrompido':
      return 'warning';
    case 'Em execução':
      return 'info';
    default:
      return '';
  }
}

function cleanError(error) {
  const message = error && error.message ? error.message : String(error);
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '');
}

function showToast(message, kind = 'info', duration = 3600) {
  if (toastTimer) clearTimeout(toastTimer);
  els.toast.className = 'toast is-visible';
  if (kind === 'error') els.toast.classList.add('is-error');
  if (kind === 'success') els.toast.classList.add('is-success');
  els.toast.textContent = message;
  toastTimer = setTimeout(() => {
    els.toast.className = 'toast';
  }, duration);
}

function createEmptySummary() {
  return {
    current: 0,
    total: 0,
    percent: null,
    folders: new Set(),
    activities: [],
    copied: null,
    added: null,
    purged: null,
    inserted: null,
    result: '',
    message: ''
  };
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function cleanStatusText(value) {
  return String(value || '')
    .replace(/\s+\d{2}:\d{2}:\d{2}\s*$/, '')
    .trim();
}

function updateDuration() {
  if (!els.summaryDuration) return;
  if (!state.runStartedAt) {
    els.summaryDuration.textContent = '00:00';
    return;
  }
  const start = new Date(state.runStartedAt).getTime();
  const end = state.runFinishedAt ? new Date(state.runFinishedAt).getTime() : Date.now();
  const seconds = Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 1000 : 0;
  els.summaryDuration.textContent = formatDuration(seconds);
}

function startDurationTimer(startedAt) {
  if (state.durationTimer) clearInterval(state.durationTimer);
  state.runStartedAt = startedAt || new Date().toISOString();
  state.runFinishedAt = null;
  updateDuration();
  state.durationTimer = setInterval(updateDuration, 1000);
}

function stopDurationTimer(finishedAt) {
  if (state.durationTimer) {
    clearInterval(state.durationTimer);
    state.durationTimer = null;
  }
  if (finishedAt) state.runFinishedAt = finishedAt;
  updateDuration();
}

function setSummaryVisible(visible) {
  els.summaryEmpty.classList.toggle('is-hidden', visible);
  els.summaryContent.classList.toggle('is-hidden', !visible);
}

function addActivity(text, key) {
  const summary = state.summary;
  if (!text) return;

  if (key) {
    const existing = summary.activities.findIndex((item) => item.key === key);
    if (existing >= 0) summary.activities.splice(existing, 1);
  } else if (summary.activities[0] && summary.activities[0].text === text) {
    return;
  }

  summary.activities.unshift({ text, key: key || '' });
  if (summary.activities.length > 7) summary.activities.length = 7;
}

function ingestLogLine(line, shouldRender = true) {
  const summary = state.summary;
  if (!line) return;
  const text = String(line);
  let match;

  if ((match = text.match(/Copied\s+(\d+)\s+of\s+(\d+)\s+messages\s+from\s+(.+)/i))) {
    summary.current = Number(match[1]);
    summary.total = Number(match[2]);
    const folder = match[3].trim();
    summary.folders.add(folder);
    summary.message = `Copiando ${match[1]} de ${match[2]} mensagens (${folder})`;
    addActivity(`Copiando ${match[1]} de ${match[2]} mensagens em ${folder}`, 'copy-progress');
  } else if ((match = text.match(/Copied\s+(\d+)\s+total\s+messages/i))) {
    summary.copied = Number(match[1]);
    addActivity(`${match[1]} mensagens copiadas no total`, 'copied-total');
  } else if ((match = text.match(/source\s+(.+?)\s+has\s+(\d+)\s+messages/i))) {
    const folder = match[1].trim();
    summary.total = Number(match[2]);
    summary.folders.add(folder);
    summary.message = `Pasta ${folder} com ${match[2]} mensagens`;
    addActivity(`Pasta ${folder} com ${match[2]} mensagens`, `source-count:${folder}`);
  } else if ((match = text.match(/There are\s+(\d+)\s+messages\s+in\s+(.+)/i))) {
    summary.total = Number(match[1]);
    const folder = match[2].trim();
    summary.folders.add(folder);
    summary.message = `Pasta ${folder} com ${match[1]} mensagens`;
    addActivity(`Pasta ${folder} com ${match[1]} mensagens`, `folder-count:${folder}`);
  } else if ((match = text.match(/Checking mailbox\s+(.+)/i))) {
    const folder = match[1].trim();
    summary.folders.add(folder);
    summary.message = `Verificando pasta ${folder}`;
    addActivity(`Verificando pasta ${folder}`, `checking:${folder}`);
  } else if ((match = text.match(/Purging mailbox\s+(.+)/i))) {
    const folder = match[1].trim();
    summary.folders.add(folder);
    summary.message = `Limpando pasta ${folder}`;
    addActivity(`Limpando pasta ${folder}`, `purging:${folder}`);
  } else if ((match = text.match(/Inserted\s+(\d+)\s+messages\s+into\s+(.+)/i))) {
    summary.inserted = Number(match[1]);
    const folder = match[2].trim();
    summary.folders.add(folder);
    addActivity(`${match[1]} mensagens enviadas para ${folder}`, `inserted:${folder}`);
  } else if ((match = text.match(/Added\s+(\d+)\s+msgs/i))) {
    summary.added = Number(match[1]);
    addActivity(`${match[1]} mensagens adicionadas`, 'added');
  } else if ((match = text.match(/Total messages purged\s+(\d+)/i)) || (match = text.match(/expunged\s+(\d+)\s+messages purged/i))) {
    summary.purged = Number(match[1]);
    addActivity(`${match[1]} mensagens purgadas`, 'purged');
  } else if ((match = text.match(/Copying\s+(\d+)\s+messages\s+in\s+(.+)/i))) {
    summary.total = Number(match[1]);
    const folder = match[2].trim();
    summary.folders.add(folder);
    summary.message = `Copiando ${match[1]} mensagens em ${folder}`;
    addActivity(`${match[1]} mensagens a copiar em ${folder}`, `copy-plan:${folder}`);
  } else if ((match = text.match(/Connecting to\s+(.+)/i))) {
    summary.message = `Conectando a ${cleanStatusText(match[1])}`;
    addActivity(summary.message, 'connecting');
  } else if ((match = text.match(/Logged in as\s+(.+)/i))) {
    summary.message = `Autenticado como ${cleanStatusText(match[1])}`;
    addActivity(summary.message, 'login');
  } else if ((match = text.match(/Number of mailboxes to process:\s*(\d+)/i)) ||
             (match = text.match(/There are\s+(\d+)\s+mailboxes\s+to\s+(?:sync|process)/i))) {
    addActivity(`${match[1]} pasta(s) na fila de processamento`, 'mailbox-total');
  } else if (/Error connecting|Login failed|Authentication failed|\bFatal\b/i.test(text)) {
    addActivity(text.length > 140 ? `${text.slice(0, 137)}...` : text, 'error');
  }

  if (summary.total > 0) {
    summary.percent = Math.min(100, Math.round((summary.current / summary.total) * 100));
  }

  if (shouldRender) renderSummary();
}

function renderSummary() {
  const summary = state.summary;
  const kind = summary.result === 'Em andamento' ? 'info' : statusKind(summary.result);

  const finished = Boolean(summary.result) && summary.result !== 'Em andamento';
  let messages = '—';

  if (finished) {
    if (summary.copied !== null) {
      messages = String(summary.copied);
    } else if (summary.inserted !== null) {
      messages = String(summary.inserted);
    } else if (summary.added !== null) {
      messages = String(summary.added);
    } else if (summary.purged !== null) {
      messages = String(summary.purged);
    } else if (summary.total > 0) {
      messages = `${summary.current} / ${summary.total}`;
    } else if (summary.current > 0) {
      messages = String(summary.current);
    }
  } else if (summary.total > 0) {
    messages = `${summary.current} / ${summary.total}`;
  } else if (summary.added !== null) {
    messages = String(summary.added);
  } else if (summary.inserted !== null) {
    messages = String(summary.inserted);
  } else if (summary.purged !== null) {
    messages = String(summary.purged);
  } else if (summary.current > 0) {
    messages = String(summary.current);
  }

  const details = [];
  if (summary.total > 0) details.push(`Progresso: ${summary.current} de ${summary.total}`);
  if (summary.copied !== null) details.push(`Copiadas: ${summary.copied}`);
  if (summary.added !== null) details.push(`Adicionadas: ${summary.added}`);
  if (summary.inserted !== null) details.push(`Inseridas: ${summary.inserted}`);
  if (summary.purged !== null) details.push(`Purgadas: ${summary.purged}`);

  let messagesLabel = 'Mensagens';
  if (finished) {
    if (summary.copied !== null) messagesLabel = 'Copiadas';
    else if (summary.inserted !== null) messagesLabel = 'Inseridas';
    else if (summary.added !== null) messagesLabel = 'Adicionadas';
    else if (summary.purged !== null) messagesLabel = 'Purgadas';
  }

  els.summaryMessagesLabel.textContent = messagesLabel;
  els.summaryMessages.textContent = messages;
  els.summaryMessages.title = details.join(' · ');
  els.summaryFolders.textContent = summary.folders.size ? String(summary.folders.size) : '—';
  els.summaryFolders.title = [...summary.folders].join(', ');
  els.summaryResult.textContent = summary.result || '—';
  els.summaryResult.className = `summary-value${kind ? ` is-${kind}` : ''}`;
  els.summaryMessage.textContent = summary.message || 'Aguardando início...';

  els.activityList.textContent = '';
  if (summary.activities.length === 0) {
    els.activityEmpty.classList.remove('is-hidden');
  } else {
    els.activityEmpty.classList.add('is-hidden');
    for (const activity of summary.activities) {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = activity.text;
      item.append(text);
      els.activityList.append(item);
    }
  }

  updateDuration();
}

function resetSummaryView() {
  stopDurationTimer();
  state.runStartedAt = null;
  state.runFinishedAt = null;
  state.summary = createEmptySummary();
  els.activityEmpty.textContent = 'Nenhuma atividade registrada ainda.';
  setSummaryVisible(false);
  renderSummary();
}

function startSummary(startedAt) {
  state.summary = createEmptySummary();
  state.summary.result = 'Em andamento';
  state.summary.message = 'Iniciando execução...';
  state.runStartedAt = null;
  state.runFinishedAt = null;
  els.activityEmpty.textContent = 'Nenhuma atividade registrada ainda.';
  setSummaryVisible(true);
  startDurationTimer(startedAt);
  renderSummary();
}

function updateLogToggleLabel() {
  const count = state.logLineCount;
  const action = state.logExpanded ? 'Ocultar processamento' : 'Ver processamento';
  els.toggleLogLabel.textContent = count
    ? `${action} (${count} ${count === 1 ? 'linha' : 'linhas'})`
    : action;
}

function setLogExpanded(expanded) {
  state.logExpanded = Boolean(expanded);
  els.logPanel.classList.toggle('is-hidden', !state.logExpanded);
  els.btnToggleLog.setAttribute('aria-expanded', String(state.logExpanded));
  updateLogToggleLabel();

  if (state.logExpanded) {
    els.logOutput.scrollTop = els.logOutput.scrollHeight;
  }
}

function aboutIsOpen() {
  return els.aboutModal.classList.contains('is-active');
}

function openAbout() {
  const system = state.system || {};
  const versions = system.versions || {};
  const runtime = [
    versions.electron ? `Electron ${versions.electron}` : '',
    versions.chrome ? `Chromium ${versions.chrome}` : '',
    versions.node ? `Node.js ${versions.node}` : ''
  ]
    .filter(Boolean)
    .join(' · ');

  els.aboutVersion.textContent = `Versão ${system.appVersion || '1.0.7'}`;
  els.aboutRuntime.textContent = runtime;
  els.aboutModal.classList.add('is-active');
  els.aboutModal.setAttribute('aria-hidden', 'false');

  const closeButton = els.aboutModal.querySelector('.modal-card-foot .button');
  if (closeButton) closeButton.focus();
}

function closeAbout() {
  if (!aboutIsOpen()) return;
  els.aboutModal.classList.remove('is-active');
  els.aboutModal.setAttribute('aria-hidden', 'true');
  els.btnAbout.focus();
}

function createBadge(tool) {
  const badge = document.createElement('span');
  badge.className = 'tool-badge';
  badge.style.background = tool.accent;
  badge.textContent = tool.badge;
  return badge;
}

function renderNav() {
  els.toolNav.textContent = '';

  let currentCategory = '';
  let currentList = null;

  for (const tool of state.tools) {
    if (tool.category !== currentCategory) {
      currentCategory = tool.category;

      const group = document.createElement('li');
      group.className = 'nav-group';

      const heading = document.createElement('p');
      heading.className = 'nav-heading';
      heading.style.setProperty('--group-color', tool.categoryColor || tool.accent);
      heading.textContent = tool.categoryTitle;

      const list = document.createElement('ul');
      list.className = 'nav-items';

      group.append(heading, list);
      els.toolNav.append(group);
      currentList = list;
    }

    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-button';
    button.dataset.toolId = tool.id;
    button.title = tool.description;

    const copy = document.createElement('span');
    copy.className = 'tool-copy';

    const title = document.createElement('strong');
    title.textContent = tool.shortTitle || tool.title;

    const subtitle = document.createElement('small');
    subtitle.textContent = tool.script;

    copy.append(title, subtitle);
    button.append(createBadge(tool), copy);
    button.addEventListener('click', () => handleToolClick(tool.id));

    li.append(button);
    currentList.append(li);
  }
}

function updateNavActive() {
  const activeId = state.activeTool ? state.activeTool.id : '';
  for (const button of els.toolNav.querySelectorAll('.tool-button')) {
    button.classList.toggle('is-active', button.dataset.toolId === activeId);
  }
}

function handleToolClick(toolId) {
  if (state.running && state.activeRun && state.activeRun.scriptName !== toolId) {
    showToast('Interrompa a execução atual antes de trocar de ferramenta.', 'error');
    return;
  }
  if (state.activeTool && state.activeTool.id === toolId) return;
  selectTool(toolId);
}

function renderSystemInfo() {
  const system = state.system;
  if (!system) return;

  const perl = system.perl || {};
  if (perl.found) {
    els.perlIndicator.className = 'tag is-success is-light is-fullwidth';
    els.perlIndicator.textContent = `Perl ${perl.version || 'disponivel'}`;
    els.perlIndicator.title = perl.command;
    els.connectionWarning.classList.add('is-hidden');
  } else {
    els.perlIndicator.className = 'tag is-danger is-light is-fullwidth';
    els.perlIndicator.textContent = 'Perl não encontrado';
    els.perlIndicator.title = perl.error || '';
    els.connectionWarning.textContent = 'Perl não encontrado';
    els.connectionWarning.classList.remove('is-hidden');
  }

  if (system.availableScripts === 0) {
    els.connectionWarning.textContent = 'Scripts Perl não encontrados';
    els.connectionWarning.classList.remove('is-hidden');
  }

  const protection = system.safeStorageAvailable
    ? 'senhas protegidas pelo sistema'
    : 'senhas com ofuscação local';
  els.sidebarHint.textContent = `SQLite local · ${protection}`;
  els.sidebarHint.title = system.dataRoot || '';
}

function renderToolMeta(tool) {
  els.topbarTool.textContent = tool.title;
  els.topbarKicker.textContent = tool.categoryShort || tool.categoryTitle || 'Turbo IMAP';
  els.heroKicker.textContent = `${tool.categoryTitle} · ${tool.script}`;
  els.heroTitle.textContent = tool.title;
  els.heroDescription.textContent = tool.description;
  els.heroNotes.textContent = tool.notes || '';
  els.hero.style.setProperty('--tool-accent', tool.accent || tool.categoryColor || '#00aff0');
  els.thunderbirdInstructions.classList.toggle(
    'is-hidden',
    tool.id !== 'imapToThunderbird'
  );
  els.resumeLabel.textContent = tool.resume.label;
  els.resumeNote.textContent = tool.resume.note || '';
  els.optionsHint.textContent = tool.fields.length
    ? 'Ajuste os parâmetros específicos desta ferramenta.'
    : 'Esta ferramenta não exige opções adicionais.';
}

function renderLastStatus(status, date) {
  const normalized = status;
  setTag(
    els.lastStatus,
    normalized || 'Nunca executado',
    normalized ? statusKind(normalized) : 'light'
  );
  els.lastRunDate.textContent = date ? formatDate(date) : 'Sem registros';
}

function optionInputId(field) {
  return `option-${field.key}`;
}

function setInputValue(id, value) {
  const input = $(id);
  if (input) input.value = value || '';
}

function applyCredentialLabels(tool) {
  els.sourceTitle.textContent = tool.sourceLabel || 'Origem';
  els.sourceHostLabel.textContent = tool.sourceHostLabel || 'Servidor IMAP';
  els.sourceUserLabel.textContent = tool.sourceUserLabel || 'Usuário';
  els.sourcePassLabel.textContent = tool.sourcePassLabel || 'Senha ou token OAuth2';

  els.destTitle.textContent = tool.destinationLabel || 'Destino';
  els.destHostLabel.textContent = tool.destinationHostLabel || 'Servidor IMAP';
  els.destUserLabel.textContent = tool.destinationUserLabel || 'Usuário';
  els.destPassLabel.textContent = tool.destinationPassLabel || 'Senha ou token OAuth2';
}

function fillForm(tool, config) {
  const source = config.source || {};
  const destination = config.destination || {};
  const options = config.options || {};

  setInputValue('source-host', source.host);
  setInputValue('source-user', source.user);
  setInputValue('source-pass', source.pass);
  setInputValue('dest-host', destination.host);
  setInputValue('dest-user', destination.user);
  setInputValue('dest-pass', destination.pass);

  applyCredentialLabels(tool);

  els.sourceColumn.classList.toggle('is-hidden', !tool.source);
  els.destColumn.classList.toggle('is-hidden', !tool.destination);
  els.sourceColumn.classList.toggle('is-12', Boolean(tool.source && !tool.destination));
  els.destColumn.classList.toggle('is-12', Boolean(tool.destination && !tool.source));
  els.sourceHostField.classList.toggle('is-hidden', !tool.source || Boolean(tool.sourceHostHidden));

  if (!tool.source) {
    setInputValue('source-host', '');
    setInputValue('source-user', '');
    setInputValue('source-pass', '');
  }

  if (!tool.destination) {
    setInputValue('dest-host', '');
    setInputValue('dest-user', '');
    setInputValue('dest-pass', '');
  }

  const resumeValue =
    typeof options.__resume === 'boolean' ? options.__resume : Boolean(tool.resume.default);
  els.resume.checked = resumeValue;
  els.resume.disabled = !tool.resume.flag;

  togglePasswordVisibility();
}

function togglePasswordVisibility() {
  const type = state.showPasswords ? 'text' : 'password';
  els.sourcePass.type = type;
  els.destPass.type = type;
}

function createHelp(text) {
  const help = document.createElement('p');
  help.className = 'help';
  help.textContent = text;
  return help;
}

function renderOptionField(tool, field, options) {
  const wrapper = document.createElement('div');
  wrapper.className = 'option-item';
  if (field.type === 'textarea') wrapper.classList.add('is-wide');
  const inputId = optionInputId(field);
  const configured = options[field.key] !== undefined ? options[field.key] : field.default;

  if (field.type === 'checkbox') {
    const label = document.createElement('label');
    label.className = 'option-checkbox';
    if (field.danger) label.classList.add('is-danger');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = inputId;
    input.checked = configured === true;

    const text = document.createElement('span');
    text.textContent = field.label;

    label.append(input, text);
    wrapper.append(label);

    if (field.help) wrapper.append(createHelp(field.help));
    return wrapper;
  }

  const label = document.createElement('label');
  label.className = 'label';
  label.htmlFor = inputId;
  label.textContent = field.label;

  const control = document.createElement('div');
  control.className = 'control';

  let input;

  if (field.type === 'select') {
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'select is-fullwidth';
    input = document.createElement('select');
    input.id = inputId;

    for (const option of field.options || []) {
      const optionElement = document.createElement('option');
      if (typeof option === 'string') {
        optionElement.value = option;
        optionElement.textContent = option;
      } else {
        optionElement.value = option.value;
        optionElement.textContent = option.label;
      }
      input.append(optionElement);
    }

    if (configured !== undefined && configured !== '') {
      input.value = String(configured);
    }

    selectWrapper.append(input);
    control.append(selectWrapper);
  } else if (field.type === 'textarea') {
    input = document.createElement('textarea');
    input.className = 'textarea';
    input.id = inputId;
    input.rows = field.rows || 4;
    input.value = configured !== undefined ? String(configured) : '';
    if (field.placeholder) input.placeholder = field.placeholder;

    control.append(input);
  } else {
    input = document.createElement('input');
    input.className = 'input';
    input.type = field.type === 'number' ? 'number' : 'text';
    input.id = inputId;
    input.value = configured !== undefined ? String(configured) : '';
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.min !== undefined) input.min = String(field.min);

    control.append(input);
  }

  wrapper.append(label, control);
  if (field.help) wrapper.append(createHelp(field.help));

  return wrapper;
}

function renderOptions(tool, config) {
  const container = els.optionsFields;
  container.textContent = '';

  if (!tool.fields.length) {
    const empty = document.createElement('p');
    empty.className = 'options-empty';
    empty.textContent = 'Nenhum parametro adicional. Basta informar as credenciais.';
    container.append(empty);
    return;
  }

  const options = (config && config.options) || {};
  for (const field of tool.fields) {
    container.append(renderOptionField(tool, field, options));
  }
}

function collectValues() {
  const tool = state.activeTool;
  const options = {};

  for (const field of tool.fields) {
    const input = $(optionInputId(field));
    if (!input) {
      options[field.key] = field.type === 'checkbox' ? false : '';
      continue;
    }
    options[field.key] = field.type === 'checkbox' ? input.checked : input.value;
  }

  return {
    source: {
      host: els.sourceHost.value.trim(),
      user: els.sourceUser.value.trim(),
      pass: els.sourcePass.value
    },
    destination: {
      host: els.destHost.value.trim(),
      user: els.destUser.value.trim(),
      pass: els.destPass.value
    },
    resume: els.resume.checked,
    options
  };
}

function clearInvalidMarks() {
  for (const input of els.toolForm.querySelectorAll('.input.is-danger, .textarea.is-danger, .select.is-danger, .is-danger.is-checkbox')) {
    input.classList.remove('is-danger');
  }
  for (const field of els.toolForm.querySelectorAll('[aria-invalid="true"]')) {
    field.removeAttribute('aria-invalid');
  }
}

function markInvalid(id) {
  const input = $(id);
  if (!input) return;
  if (input.tagName === 'INPUT' || input.tagName === 'SELECT') {
    input.classList.add('is-danger');
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

function validateValues(tool, values) {
  const checks = [];

  if (tool.source) {
    if (!tool.sourceHostHidden) {
      checks.push(['source-host', values.source.host, 'Informe o servidor de origem.']);
    }
    checks.push(['source-user', values.source.user, 'Informe o usuário de origem.']);
    checks.push(['source-pass', values.source.pass, 'Informe a senha de origem.']);
  }

  if (tool.destination) {
    checks.push(
      ['dest-host', values.destination.host, 'Informe o servidor de destino.'],
      ['dest-user', values.destination.user, 'Informe o usuário de destino.'],
      ['dest-pass', values.destination.pass, 'Informe a senha de destino.']
    );
  }

  for (const field of tool.fields) {
    if (!field.required) continue;
    const value = values.options[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      checks.push([optionInputId(field), '', `Preencha o campo "${field.label}".`]);
    }
  }

  for (const [id, value, message] of checks) {
    if (value) continue;
    markInvalid(id);
    return message;
  }

  if (tool.requiredOneOf) {
    const satisfied = tool.requiredOneOf.keys.some((key) => {
      const value = values.options[key];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
    if (!satisfied) {
      markInvalid(optionInputId({ key: tool.requiredOneOf.keys[0] }));
      return tool.requiredOneOf.message;
    }
  }

  for (const field of tool.fields) {
    if (field.type !== 'number') continue;
    const value = values.options[field.key];
    if (value === undefined || String(value).trim() === '') continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      markInvalid(optionInputId(field));
      return `O campo "${field.label}" deve ser um número positivo.`;
    }
  }

  return '';
}

function dangerousActions(tool, values) {
  const actions = [];
  for (const field of tool.fields) {
    if (field.danger && values.options[field.key] === true) {
      actions.push(field.label);
    }
  }
  if (tool.id === 'purgeMbx') {
    actions.push(`Limpar a pasta "${values.options.mailbox}" (todas as mensagens serão removidas).`);
  }
  if (tool.id === 'delete_imap_mailboxes' && values.options.testMode !== true) {
    actions.push(`Excluir as pastas que correspondem a "${values.options.mailboxRegex}".`);
  }
  if (tool.id === 'imapfilter' && values.options.testMode !== true) {
    actions.push('Aplicar as regras de filtro de verdade no servidor.');
  }
  return actions;
}

async function selectTool(toolId, options = {}) {
  const tool = state.tools.find((item) => item.id === toolId);
  if (!tool) return;

  const sameRunning = state.running && state.activeRun && state.activeRun.scriptName === toolId;

  if (!sameRunning) {
    clearLog();
    setLogExpanded(false);
  }

  state.activeTool = tool;
  localStorage.setItem('turbo-imap:last-tool', tool.id);
  updateNavActive();

  renderToolMeta(tool);
  renderLastStatus('', '');
  renderOptions(tool, { options: {} });

  try {
    const [config, progress] = await Promise.all([
      api.getConfig(tool.id),
      api.getProgress(tool.id)
    ]);

    if (!state.activeTool || state.activeTool.id !== tool.id) return;

    state.config = config;
    renderOptions(tool, config);
    fillForm(tool, config);
    renderLastStatus(config.lastStatus, config.lastRunDate);

    if (sameRunning && state.activeRun) {
      restoreActiveRun(state.activeRun);
    } else if (state.running) {
      resetRunUi();
    } else {
      applySavedProgress(progress);
      resetRunUi(false);
    }

    loadHistory(tool.id);
  } catch (error) {
    showToast(cleanError(error), 'error', 6000);
  }
}

function statusProgressClass(status) {
  switch (status) {
    case 'Sucesso':
      return 'is-success';
    case 'Falha':
      return 'is-danger';
    case 'Interrompido':
      return 'is-warning';
    default:
      return 'is-primary';
  }
}

function applyProgress(progress, forcedStatus) {
  if (!progress) {
    els.progressBar.max = 100;
    els.progressBar.value = 0;
    els.progressBar.className = 'progress is-primary';
    els.progressLabel.textContent = 'Aguardando início';
    els.progressPercent.textContent = '0%';
    return;
  }

  const status = forcedStatus || progress.status || '';
  const finished = Boolean(status) && status !== 'Em execução' && status !== 'Em execucao';
  const total = Number(progress.total) || 0;
  const percent =
    typeof progress.percent === 'number'
      ? progress.percent
      : total > 0
        ? Math.min(100, Math.round(((Number(progress.current) || 0) / total) * 100))
        : null;

  els.progressBar.className = `progress ${statusProgressClass(status)}`;
  els.progressBar.max = 100;

  if (total > 0 || (finished && percent !== null)) {
    const value = percent === null ? (status === 'Sucesso' ? 100 : 0) : percent;
    els.progressBar.value = value;
    els.progressPercent.textContent = `${value}%`;
  } else if (finished) {
    const value = status === 'Sucesso' ? 100 : 0;
    els.progressBar.value = value;
    els.progressPercent.textContent = status === 'Sucesso' ? '100%' : '—';
  } else {
    els.progressBar.removeAttribute('value');
    els.progressPercent.textContent = '—';
  }

  const detail = cleanStatusText(progress.message || (finished ? status : 'Processando...'));
  els.progressLabel.textContent = detail;
  els.progressLabel.title = detail;
}

function applySavedProgress(progress) {
  if (!progress) {
    resetSummaryView();
    applyProgress(null);
    return;
  }

  let status = progress.status || '';
  if (status === 'Em execução' || status === 'Em execucao') status = 'Interrompido';

  if (state.durationTimer) {
    clearInterval(state.durationTimer);
    state.durationTimer = null;
  }

  state.summary = createEmptySummary();
  state.summary.current = Number(progress.current) || 0;
  state.summary.total = Number(progress.total) || 0;
  state.summary.percent = typeof progress.percent === 'number' ? progress.percent : null;
  state.summary.message =
    status === 'Falha'
      ? 'A última execução falhou. Consulte o processamento para detalhes.'
      : status === 'Interrompido'
        ? 'A última execução foi interrompida.'
        : status === 'Sucesso'
          ? 'Concluído com sucesso'
          : cleanStatusText(progress.message) || '';
  state.summary.result = status;
  state.runStartedAt = progress.startedAt || null;
  state.runFinishedAt = progress.updatedAt || progress.startedAt || null;

  els.activityEmpty.textContent = 'Atividades recentes não disponíveis para execuções anteriores.';
  setSummaryVisible(true);
  renderSummary();
  applyProgress(progress, status);
}

function resetRunUi(clearProgress = true) {
  if (clearProgress) {
    applyProgress(null);
    resetSummaryView();
  }
  els.runState.textContent = 'Aguardando';
  els.runState.className = 'tag is-light';
  els.runStarted.textContent = 'Nenhum processo ativo';
  setTag(els.runPill, 'Ocioso', 'light');
  els.btnRun.classList.remove('is-hidden');
  els.btnRun.disabled = false;
  els.btnStop.classList.add('is-hidden');
  els.btnSave.disabled = false;
}

function markRunning(snapshot) {
  state.running = true;
  els.runState.textContent = 'Em execução';
  els.runState.className = 'tag is-info';
  els.runStarted.textContent = `Iniciado em ${formatDate(snapshot.startedAt)}`;
  setTag(els.runPill, 'Executando...', 'info');
  els.btnRun.classList.add('is-hidden');
  els.btnStop.classList.remove('is-hidden');
  els.btnStop.disabled = false;
  els.btnSave.disabled = true;
}

function restoreActiveRun(snapshot) {
  if (!snapshot) return;

  state.running = true;
  state.activeRun = snapshot;

  startSummary(snapshot.startedAt);
  markRunning(snapshot);
  clearLog();
  setLogExpanded(false);
  appendLog('--- Reconectado a uma execução em andamento ---');

  if (Array.isArray(snapshot.recentLogs)) {
    for (const line of snapshot.recentLogs) {
      ingestLogLine(line, false);
      appendLog(line);
    }
  }

  const progress = snapshot.progress || {};
  state.summary.current = Number(progress.current) || 0;
  state.summary.total = Number(progress.total) || 0;
  state.summary.percent = typeof progress.percent === 'number' ? progress.percent : null;
  state.summary.message = cleanStatusText(progress.message) || 'Processamento em andamento';
  state.summary.result = 'Em andamento';
  setSummaryVisible(true);
  renderSummary();

  applyProgress(snapshot.progress);
}

async function loadHistory(toolId) {
  const request = ++historyRequest;
  try {
    const rows = await api.getHistory(toolId);
    if (request !== historyRequest) return;
    if (!state.activeTool || state.activeTool.id !== toolId) return;
    state.history = rows;
    renderHistory(rows);
  } catch (error) {
    showToast(cleanError(error), 'error', 5000);
  }
}

function renderHistory(rows) {
  els.historyList.textContent = '';

  if (!rows || rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'Nenhuma execução registrada.';
    els.historyList.append(empty);
    return;
  }

  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'history-row';
    if (row.status === 'Sucesso') item.classList.add('status-success');
    if (row.status === 'Falha') item.classList.add('status-failure');
    if (row.status === 'Interrompido') item.classList.add('status-stopped');

    const meta = document.createElement('div');
    meta.className = 'history-meta';

    const title = document.createElement('strong');
    title.textContent = formatDate(row.started_at);

    const detail = document.createElement('small');
    const code = Number.isInteger(row.exit_code) ? ` - código ${row.exit_code}` : '';
    detail.textContent = `${row.status}${code}`;

    meta.append(title, detail);
    item.append(meta);

    if (row.log_file) {
      const actions = document.createElement('div');
      actions.className = 'buttons are-small has-addons';

      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'button is-small is-light';
      viewButton.textContent = 'Ver';
      viewButton.addEventListener('click', () => viewLog(row.log_file));

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'button is-small is-ghost';
      openButton.textContent = 'Abrir';
      openButton.addEventListener('click', () => openLog(row.log_file));

      actions.append(viewButton, openButton);
      item.append(actions);
    }

    els.historyList.append(item);
  }
}

function appendLog(line) {
  const text = String(line);
  els.logOutput.append(document.createTextNode(text + '\n'));
  state.logLineCount += 1;

  while (els.logOutput.childNodes.length > 4000) {
    els.logOutput.removeChild(els.logOutput.firstChild);
  }

  if (els.autoscroll.checked) {
    els.logOutput.scrollTop = els.logOutput.scrollHeight;
  }

  updateLogToggleLabel();
}

function clearLog() {
  els.logOutput.textContent = '';
  state.logLineCount = 0;
  updateLogToggleLabel();
}

async function viewLog(logFile) {
  try {
    const result = await api.readLog(logFile);
    if (!result || !result.content) {
      showToast(result && result.error ? result.error : 'Log vazio ou não encontrado.', 'error');
      return;
    }

    clearLog();
    const lines = result.content.split(/\r?\n/);
    const tail = lines.slice(-1200);
    appendLog(tail.join('\n'));
    setLogExpanded(true);
    els.logOutput.scrollTop = els.logOutput.scrollHeight;
  } catch (error) {
    showToast(cleanError(error), 'error');
  }
}

async function openLog(logFile) {
  const result = await api.openLog(logFile);
  if (!result || !result.ok) {
    showToast((result && result.error) || 'Não foi possível abrir o log.', 'error');
  }
}

async function runTool() {
  if (!state.activeTool || state.running) return;

  clearInvalidMarks();
  const tool = state.activeTool;
  const values = collectValues();
  const validationError = validateValues(tool, values);

  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  const dangerous = dangerousActions(tool, values);
  if (dangerous.length > 0) {
    const confirmed = window.confirm(
      'Atenção! Esta execução pode alterar ou remover dados:\n\n' +
        dangerous.map((action) => `- ${action}`).join('\n') +
        '\n\nDeseja continuar?'
    );
    if (!confirmed) return;
  }

  els.btnRun.disabled = true;
  const startedAt = new Date().toISOString();
  clearLog();
  setLogExpanded(false);
  startSummary(startedAt);
  applyProgress({
    current: 0,
    total: 0,
    percent: null,
    message: 'Iniciando execução...'
  });

  markRunning({ startedAt });

  try {
    const result = await api.startRun(tool.id, values);
    state.running = true;
    state.activeRun = {
      ...(result && result.snapshot ? result.snapshot : {}),
      runId: result && result.runId
    };
    if (result && result.snapshot) {
      markRunning(result.snapshot);
      applyProgress(result.snapshot.progress);
    }
  } catch (error) {
    state.running = false;
    state.activeRun = null;
    resetRunUi();
    showToast(cleanError(error), 'error', 7000);
  }
}

async function stopTool() {
  if (!state.running) return;
  els.btnStop.disabled = true;
  try {
    const result = await api.stopRun();
    if (!result || !result.stopped) {
      showToast('Não há processo ativo para interromper.', 'error');
      els.btnStop.disabled = false;
      return;
    }
    showToast('Interrompendo a execução...', 'info');
  } catch (error) {
    els.btnStop.disabled = false;
    showToast(cleanError(error), 'error');
  }
}

async function saveConfig() {
  if (!state.activeTool) return;
  try {
    await api.saveConfig(state.activeTool.id, collectValues());
    showToast('Configuração salva.', 'success');
  } catch (error) {
    showToast(cleanError(error), 'error', 6000);
  }
}

function handleRunEvent(event) {
  if (!event || !event.type) return;

  switch (event.type) {
    case 'started': {
      if (!state.activeTool || event.scriptName !== state.activeTool.id) return;
      state.running = true;
      state.activeRun = event;
      markRunning(event);

      if (!state.runStartedAt) {
        startSummary(event.startedAt);
      } else {
        state.runStartedAt = event.startedAt;
        updateDuration();
      }

      state.summary.result = 'Em andamento';
      if (event.progress && event.progress.message) {
        state.summary.message = event.progress.message;
      }
      setSummaryVisible(true);
      renderSummary();
      applyProgress(event.progress);
      break;
    }

    case 'log':
      ingestLogLine(event.line);
      appendLog(event.line);
      break;

    case 'progress':
      applyProgress(event.progress);
      if (event.progress) {
        state.summary.current = Number(event.progress.current) || 0;
        state.summary.total = Number(event.progress.total) || 0;
        state.summary.percent =
          typeof event.progress.percent === 'number' ? event.progress.percent : null;
        if (event.progress.message) state.summary.message = cleanStatusText(event.progress.message);
        renderSummary();
      }
      break;

    case 'status':
      if (event.message) {
        const friendly = cleanStatusText(event.message);
        els.progressLabel.textContent = friendly;
        els.progressLabel.title = friendly;
        state.summary.message = friendly;
        renderSummary();
      }
      break;

    case 'done': {
      state.running = false;
      state.activeRun = null;

      els.btnRun.classList.remove('is-hidden');
      els.btnRun.disabled = false;
      els.btnStop.classList.add('is-hidden');
      els.btnStop.disabled = false;
      els.btnSave.disabled = false;

      els.runState.textContent = event.status;
      els.runState.className = `tag ${statusKind(event.status) ? `is-${statusKind(event.status)}` : 'is-light'}`;
      els.runStarted.textContent = `Finalizado em ${formatDate(event.finishedAt)}`;

      const pillKind = statusKind(event.status);
      setTag(els.runPill, event.status, pillKind || 'light');

      applyProgress({ ...event.progress, status: event.status }, event.status);

      state.summary.current = Number(event.progress && event.progress.current) || 0;
      state.summary.total = Number(event.progress && event.progress.total) || 0;
      state.summary.percent =
        event.progress && typeof event.progress.percent === 'number'
          ? event.progress.percent
          : null;
      state.summary.result = event.status;
      state.summary.message =
        event.status === 'Sucesso'
          ? 'Concluído com sucesso'
          : event.status === 'Interrompido'
            ? 'Processamento interrompido'
            : 'Processamento finalizado com falha';
      addActivity(
        event.status === 'Sucesso'
          ? 'Processamento concluído com sucesso'
          : event.status === 'Interrompido'
            ? 'Processamento interrompido'
            : 'Processamento finalizado com falha',
        'final'
      );
      stopDurationTimer(event.finishedAt);
      setSummaryVisible(true);
      renderSummary();
      renderLastStatus(event.status, event.finishedAt);

      if (event.status === 'Sucesso') {
        showToast('Execução concluída com sucesso.', 'success', 5000);
      } else if (event.status === 'Interrompido') {
        showToast('Execução interrompida.', 'info', 5000);
      } else {
        showToast('A execução falhou. Verifique o log.', 'error', 7000);
      }

      if (state.activeTool && state.activeTool.id === event.scriptName) {
        loadHistory(state.activeTool.id);
        api
          .getConfig(state.activeTool.id)
          .then((config) => {
            if (state.activeTool && state.activeTool.id === event.scriptName) {
              state.config = config;
            }
          })
          .catch(() => {});
      }
      break;
    }
  }
}

function bindEvents() {
  els.showPasswords.addEventListener('change', () => {
    state.showPasswords = els.showPasswords.checked;
    togglePasswordVisibility();
  });

  els.toolForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runTool();
  });

  els.btnStop.addEventListener('click', stopTool);
  els.btnSave.addEventListener('click', saveConfig);
  els.btnAbout.addEventListener('click', openAbout);
  els.btnOpenRepo.addEventListener('click', async () => {
    const result = await api.openRepository();
    if (!result || !result.ok) {
      showToast((result && result.error) || 'Não foi possível abrir o repositório.', 'error');
    }
  });
  els.btnToggleLog.addEventListener('click', () => setLogExpanded(!state.logExpanded));

  for (const element of els.aboutModal.querySelectorAll('[data-close-about]')) {
    element.addEventListener('click', closeAbout);
  }

  els.btnOpenLogs.addEventListener('click', async () => {
    const result = await api.openLogsFolder();
    if (!result || !result.ok) {
      showToast((result && result.error) || 'Não foi possível abrir a pasta de logs.', 'error');
    }
  });

  els.btnClearLog.addEventListener('click', clearLog);

  els.toolForm.addEventListener('input', (event) => {
    const target = event.target;
    if (target && target.classList && target.classList.contains('is-danger')) {
      target.classList.remove('is-danger');
      target.removeAttribute('aria-invalid');
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && aboutIsOpen()) {
      event.preventDefault();
      closeAbout();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !aboutIsOpen()) {
      event.preventDefault();
      if (!state.running) runTool();
    }
  });
}

async function init() {
  cacheElements();
  bindEvents();
  resetSummaryView();
  setLogExpanded(false);

  api.onRunEvent(handleRunEvent);

  try {
    const [tools, system, active] = await Promise.all([
      api.getTools(),
      api.getSystemInfo(),
      api.getActiveRun()
    ]);

    state.tools = tools;
    state.system = system;

    renderSystemInfo();
    renderNav();

    const savedTool = localStorage.getItem('turbo-imap:last-tool');
    const initialTool = tools.find((tool) => tool.id === savedTool) || tools[0];

    if (active && active.running) {
      state.running = true;
      state.activeRun = active;
      await selectTool(active.scriptName, { force: true });
    } else if (initialTool) {
      await selectTool(initialTool.id);
    }

    if (!system.perl || !system.perl.found) {
      showToast(
        'Perl não encontrado. No Windows, reinstale o aplicativo; em desenvolvimento, rode npm run prepare:perl.',
        'error',
        8000
      );
    }
  } catch (error) {
    showToast(`Falha ao carregar o Turbo IMAP: ${cleanError(error)}`, 'error', 9000);
  }
}

document.addEventListener('DOMContentLoaded', init);
