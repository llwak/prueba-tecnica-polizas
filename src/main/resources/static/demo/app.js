'use strict';

const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  'connection', 'key-form', 'api-key', 'policy-count', 'refresh', 'filter-type',
  'filter-status', 'policies', 'list-empty', 'detail-title', 'detail-type', 'detail-status',
  'detail-empty', 'detail-body', 'rent', 'premium', 'term', 'renew', 'cancel', 'add-risk',
  'risk-count', 'risks', 'notice', 'notice-title', 'notice-message', 'trace', 'trace-label',
  'trace-body', 'operation', 'operation-form', 'operation-title', 'operation-copy',
  'operation-input', 'operation-label', 'operation-value', 'operation-error',
  'close-operation', 'submit-operation', 'overview-filters', 'overview-message', 'overview-rent',
  'dashboard-view', 'policies-view', 'dashboard-link', 'policies-link', 'page-title', 'refresh-dashboard',
  'dashboard-charts', 'status-donut', 'donut-total', 'status-legend', 'type-chart',
  'quarter-chart', 'quarter-empty', 'rent-chart',
  'pagination', 'page-range', 'previous-page', 'next-page'
].map(id => [id, byId(id)]));

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2
});
const percent = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });
const calendar = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });
const apiRoot = new URL('../', window.location.href);
const types = { INDIVIDUAL: 'Individual', COLECTIVA: 'Colectiva' };
const statuses = {
  ACTIVA: 'Activa', ACTIVO: 'Activo', RENOVADA: 'Renovada',
  CANCELADA: 'Cancelada', CANCELADO: 'Cancelado'
};
const series = [
  { state: 'ACTIVA', label: 'Activas', color: 'var(--chart-active)' },
  { state: 'RENOVADA', label: 'Renovadas', color: 'var(--chart-renewed)' },
  { state: 'CANCELADA', label: 'Canceladas', color: 'var(--chart-cancelled)' }
];
const overviewCards = [...ui['overview-filters'].querySelectorAll('button')];
const pageSize = 6;

let apiKey = ui['api-key'].value;
let policies = [];
let selected = null;
let risks = [];
let listRequest = 0;
let overviewRequest = 0;
let riskRequest = 0;
let operation = null;
let busy = false;
let pageNumber = 1;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setBadge(element, status) {
  element.dataset.state = status;
  element.textContent = statuses[status] ?? status;
}

function connection(state, message) {
  ui.connection.dataset.state = state;
  ui.connection.textContent = message;
}

function notify(state, title, message) {
  ui.notice.hidden = false;
  ui.notice.dataset.state = state;
  ui['notice-title'].textContent = title;
  ui['notice-message'].textContent = message;
}

async function api(path, method = 'GET', body) {
  const headers = { 'x-api-key': apiKey, Accept: 'application/json' };
  const options = { method, headers, signal: AbortSignal.timeout(8000) };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(new URL(path.slice(1), apiRoot), options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(data?.detail ?? 'La API no pudo completar la solicitud.'), {
      status: response.status, data
    });
  }
  return { status: response.status, data };
}

function errorMessage(error) {
  if (error.status === 401) return 'Revisa la clave en el menú Clave de API.';
  if (error.status) return error.message;
  return 'No se obtuvo respuesta. Comprueba la conexión y consulta el estado antes de reintentar.';
}

function renderView() {
  const showPolicies = window.location.hash === '#polizas';
  ui['dashboard-view'].hidden = showPolicies;
  ui['policies-view'].hidden = !showPolicies;
  ui['dashboard-link'].removeAttribute('aria-current');
  ui['policies-link'].removeAttribute('aria-current');
  ui[showPolicies ? 'policies-link' : 'dashboard-link'].setAttribute('aria-current', 'page');
}

function stateCounts() {
  return { ACTIVA: 0, RENOVADA: 0, CANCELADA: 0 };
}

function summarizePortfolio(policies) {
  const counts = stateCounts();
  const byType = {
    INDIVIDUAL: { label: 'Individuales', total: 0, counts: stateCounts(), rent: 0 },
    COLECTIVA: { label: 'Colectivas', total: 0, counts: stateCounts(), rent: 0 }
  };
  const quarters = new Map();

  for (const policy of policies) {
    const type = byType[policy.tipo];
    counts[policy.estado]++;
    type.counts[policy.estado]++;
    type.total++;
    if (policy.estado === 'CANCELADA') continue;

    type.rent += Math.round(policy.canonMensual * 100);
    const [year, month] = policy.finVigencia.split('-').map(Number);
    const quarter = year * 4 + Math.floor((month - 1) / 3);
    quarters.set(quarter, (quarters.get(quarter) ?? 0) + 1);
  }

  return { counts, types: Object.values(byType), quarters: [...quarters].sort(([a], [b]) => a - b) };
}

function renderStatusChart(counts, total) {
  let offset = 0;
  const stops = [];
  const rows = series.map(({ state, label, color }) => {
    const share = total ? counts[state] / total : 0;
    const end = offset + share * 100;
    if (share) stops.push(`${color} ${offset}% ${end}%`);
    offset = end;

    const row = node('li');
    const name = node('span', '', label);
    name.dataset.status = state;
    row.append(name, node('strong', '', counts[state]), node('span', 'status-percent', percent.format(share)));
    return row;
  });

  ui['status-donut'].style.background = stops.length ? `conic-gradient(${stops.join(', ')})` : '';
  ui['donut-total'].textContent = total;
  ui['status-legend'].replaceChildren(...rows);
}

function horizontalRow(label, value) {
  const row = node('li');
  const caption = node('div', 'chart-row-label');
  caption.append(node('span', '', label), node('strong', '', value));
  const track = node('div', 'chart-track');
  row.append(caption, track);
  return { row, track };
}

function renderTypeChart(typeSummary) {
  const max = Math.max(1, ...typeSummary.map(type => type.total));
  ui['type-chart'].replaceChildren(...typeSummary.map(type => {
    const { row, track } = horizontalRow(type.label, type.total);
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', series.map(({ state, label }) => `${label}: ${type.counts[state]}`).join(', '));
    for (const { state, label } of series) {
      const count = type.counts[state];
      const bar = node('span');
      bar.dataset.status = state;
      bar.style.width = `${count / max * 100}%`;
      bar.title = `${label}: ${count}`;
      track.append(bar);
    }
    return row;
  }));
}

function renderQuarterChart(quarters) {
  ui['quarter-empty'].hidden = quarters.length > 0;
  ui['quarter-chart'].style.setProperty('--quarters', Math.max(1, quarters.length));
  const max = Math.max(1, ...quarters.map(([, count]) => count));
  ui['quarter-chart'].replaceChildren(...quarters.map(([quarter, count]) => {
    const label = `T${quarter % 4 + 1} ${Math.floor(quarter / 4)}`;
    const row = node('li');
    const track = node('div', 'quarter-track');
    track.style.setProperty('--bar-height', `${count / max * 80}%`);
    const bar = node('span', 'quarter-bar');
    bar.setAttribute('aria-hidden', 'true');
    track.append(bar, node('strong', 'quarter-count', count));
    row.append(track, node('span', 'quarter-label', label));
    return row;
  }));
}

function renderRentChart(typeSummary) {
  const total = typeSummary.reduce((sum, type) => sum + type.rent, 0);
  ui['overview-rent'].textContent = currency.format(total / 100);
  ui['rent-chart'].replaceChildren(...typeSummary.map((type, index) => {
    const share = total ? type.rent / total : 0;
    const { row, track } = horizontalRow(type.label, `${currency.format(type.rent / 100)} · ${percent.format(share)}`);
    track.setAttribute('aria-hidden', 'true');
    const bar = node('span', index === 1 ? 'collective-amount' : '');
    bar.style.width = `${share * 100}%`;
    track.append(bar);
    return row;
  }));
}

function renderOverview(portfolio) {
  const summary = portfolio ? summarizePortfolio(portfolio) : null;
  for (const card of overviewCards) {
    const status = card.dataset.overviewStatus;
    card.querySelector('strong').textContent = status ? (summary?.counts[status] ?? '—') : (portfolio?.length ?? '—');
    card.disabled = !summary;
  }
  ui['dashboard-charts'].hidden = !summary;
  ui['overview-message'].textContent = summary ? '' : 'Resumen temporalmente no disponible.';
  if (!summary) return;

  renderStatusChart(summary.counts, portfolio.length);
  renderTypeChart(summary.types);
  renderQuarterChart(summary.quarters);
  renderRentChart(summary.types);
}

async function refreshOverview() {
  const request = ++overviewRequest;
  let portfolio = null;
  try {
    const { data } = await api('/polizas');
    portfolio = data;
  } catch {
    // Render the unavailable state if the unfiltered request fails.
  }
  if (request === overviewRequest) renderOverview(portfolio);
}

function updateSelectedRow() {
  for (const button of ui.policies.querySelectorAll('button[data-id]')) {
    const active = Number(button.dataset.id) === selected?.id;
    button.closest('tr').classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderPolicies() {
  const start = (pageNumber - 1) * pageSize;
  const end = Math.min(start + pageSize, policies.length);
  const rows = policies.slice(start, end).map(policy => {
    const row = node('tr');
    const choose = node('button', 'policy-link', `#${policy.id}`);
    choose.type = 'button';
    choose.dataset.id = policy.id;
    choose.setAttribute('aria-label', `Ver póliza ${policy.id}`);
    row.addEventListener('click', () => selectPolicy(policy));

    const id = node('td');
    id.append(choose);
    const state = node('td');
    const badge = node('span', 'badge');
    setBadge(badge, policy.estado);
    state.append(badge);
    row.append(id, node('td', '', types[policy.tipo]), state, node('td', '', currency.format(policy.canonMensual)));
    return row;
  });
  ui.policies.replaceChildren(...rows);
  updateSelectedRow();
  ui['policy-count'].textContent = policies.length === 1 ? '1 póliza' : `${policies.length} pólizas`;
  ui['list-empty'].hidden = rows.length > 0;
  ui['list-empty'].textContent = 'No hay pólizas que coincidan con los filtros.';
  ui.pagination.hidden = policies.length <= pageSize;
  ui['page-range'].textContent = policies.length ? `${start + 1}–${end} de ${policies.length}` : '';
  ui['previous-page'].disabled = start === 0;
  ui['next-page'].disabled = end === policies.length;
}

function changePage(offset) {
  pageNumber += offset;
  renderPolicies();
  selectPolicy(policies[(pageNumber - 1) * pageSize]);
}

async function loadPolicies(preferredId = selected?.id, updateOverview = true) {
  const current = ++listRequest;
  const filters = new URLSearchParams();
  if (ui['filter-type'].value) filters.set('tipo', ui['filter-type'].value);
  if (ui['filter-status'].value) filters.set('estado', ui['filter-status'].value);
  const path = filters.size ? `/polizas?${filters}` : '/polizas';
  const unfilteredRequest = filters.size ? null : ++overviewRequest;
  const pendingOverview = filters.size && updateOverview ? refreshOverview() : null;
  ui.refresh.disabled = true;
  ui['refresh-dashboard'].disabled = true;
  connection('loading', 'Consultando API');

  try {
    const { data } = await api(path);
    if (unfilteredRequest === overviewRequest) renderOverview(data);
    if (current !== listRequest) return;
    policies = data;
    const preferredIndex = policies.findIndex(policy => policy.id === preferredId);
    pageNumber = Math.floor(Math.max(preferredIndex, 0) / pageSize) + 1;
    renderPolicies();
    connection('ready', 'API conectada');
    await selectPolicy(policies[preferredIndex] ?? policies[0] ?? null);
  } catch (error) {
    if (unfilteredRequest === overviewRequest) renderOverview(null);
    if (current !== listRequest) return;
    policies = [];
    pageNumber = 1;
    renderPolicies();
    await selectPolicy(null);
    ui['list-empty'].textContent = 'No se pudieron cargar las pólizas.';
    connection('error', error.status === 401 ? 'Clave inválida' : 'API sin respuesta');
    notify('error', 'Error al consultar pólizas', errorMessage(error));
  } finally {
    await pendingOverview;
    if (current === listRequest) {
      ui.refresh.disabled = false;
      ui['refresh-dashboard'].disabled = false;
    }
  }
}

async function selectPolicy(policy) {
  selected = policy;
  risks = [];
  const current = ++riskRequest;
  updateSelectedRow();

  ui['detail-body'].hidden = !policy;
  ui['detail-empty'].hidden = Boolean(policy);
  ui['detail-status'].hidden = !policy;
  ui['detail-title'].textContent = policy ? `Póliza #${policy.id}` : 'Detalle de póliza';
  ui['detail-type'].textContent = policy ? `Póliza ${types[policy.tipo].toLowerCase()}` : '';
  if (!policy) return;

  setBadge(ui['detail-status'], policy.estado);
  ui.rent.textContent = currency.format(policy.canonMensual);
  ui.premium.textContent = currency.format(policy.prima);
  const start = calendar.format(new Date(policy.inicioVigencia));
  const end = calendar.format(new Date(policy.finVigencia));
  ui.term.textContent = `${start} – ${end} · ${policy.mesesVigencia} meses`;
  ui.renew.disabled = policy.estado === 'CANCELADA';
  ui.cancel.disabled = policy.estado === 'CANCELADA';
  ui['add-risk'].hidden = policy.tipo !== 'COLECTIVA';
  ui['add-risk'].disabled = policy.estado === 'CANCELADA';
  ui['risk-count'].textContent = 'Cargando riesgos…';
  ui.risks.replaceChildren();

  try {
    const { data } = await api(`/polizas/${policy.id}/riesgos`);
    if (current !== riskRequest) return;
    risks = data;
    renderRisks();
  } catch (error) {
    if (current !== riskRequest) return;
    ui['risk-count'].textContent = 'No se pudieron cargar los riesgos.';
    notify('error', 'Error al consultar riesgos', errorMessage(error));
  }
}

function renderRisks() {
  const items = risks.map(risk => {
    const row = node('li');
    const identity = node('div', 'risk-name');
    identity.append(node('strong', '', risk.referenciaInmueble), node('span', 'risk-id', `Riesgo #${risk.id}`));

    const actions = node('div', 'risk-actions');
    const badge = node('span', 'badge');
    setBadge(badge, risk.estado);
    actions.append(badge);
    if (risk.estado !== 'CANCELADO' && selected.estado !== 'CANCELADA') {
      const button = node('button', 'button secondary danger-text', 'Cancelar');
      button.type = 'button';
      button.setAttribute('aria-label', `Cancelar riesgo ${risk.id}`);
      button.addEventListener('click', () => openOperation({
        title: 'Cancelar riesgo',
        copy: `El riesgo ${risk.referenciaInmueble} quedará cancelado en la póliza #${risk.polizaId}.`,
        action: 'Cancelar riesgo',
        path: `/riesgos/${risk.id}/cancelar`,
        policyId: risk.polizaId,
        success: 'Riesgo cancelado',
        dangerous: true
      }));
      actions.append(button);
    }
    row.append(identity, actions);
    return row;
  });
  ui.risks.replaceChildren(...items);
  const active = risks.filter(risk => risk.estado === 'ACTIVO').length;
  const activeLabel = active === 1 ? 'activo' : 'activos';
  const registeredLabel = items.length === 1 ? 'registrado' : 'registrados';
  ui['risk-count'].textContent = items.length
    ? `${active} ${activeLabel} de ${items.length} ${registeredLabel}`
    : 'Sin riesgos registrados.';
}

function openOperation(config) {
  if (busy || !selected) return;
  operation = config;
  ui['operation-title'].textContent = config.title;
  ui['operation-copy'].textContent = config.copy;
  ui['operation-input'].hidden = !config.input;
  ui['operation-error'].hidden = true;
  ui['submit-operation'].textContent = config.action;
  ui['submit-operation'].className = `button ${config.dangerous ? 'danger' : 'primary'}`;
  const input = ui['operation-value'];
  input.required = Boolean(config.input);
  input.type = config.input?.type ?? 'text';
  input.value = config.input?.initial ?? '';
  for (const name of ['min', 'max', 'step', 'maxlength']) {
    if (config.input?.[name] !== undefined) input.setAttribute(name, config.input[name]);
    else input.removeAttribute(name);
  }
  ui['operation-label'].textContent = config.input?.label ?? '';
  ui.operation.showModal();
  (config.input ? input : ui['close-operation']).focus();
}

function trace(path, result) {
  ui.trace.hidden = false;
  ui['trace-label'].textContent = `POST ${path} · ${result.status ? `HTTP ${result.status}` : 'Sin respuesta'}`;
  ui['trace-body'].textContent = result.data ? JSON.stringify(result.data, null, 2) : 'Sin cuerpo de respuesta.';
}

function renewal() {
  const { id, mesesVigencia } = selected;
  openOperation({
    title: 'Renovar póliza',
    copy: `Aplica el IPC al canon de la póliza #${id} y abre una nueva vigencia de ${mesesVigencia} meses.`,
    action: 'Confirmar renovación',
    path: `/polizas/${id}/renovar`,
    policyId: id,
    success: 'Póliza renovada',
    input: { type: 'number', label: 'IPC (%)', initial: '5.25', min: '0', max: '999.9999', step: '0.0001' },
    body: input => ({ ipc: input.valueAsNumber })
  });
}

function cancellation() {
  const { id } = selected;
  openOperation({
    title: 'Cancelar póliza',
    copy: `La póliza #${id} y todos sus riesgos quedarán cancelados.`,
    action: 'Confirmar cancelación',
    path: `/polizas/${id}/cancelar`,
    policyId: id,
    success: 'Póliza cancelada',
    dangerous: true
  });
}

function newRisk() {
  const { id } = selected;
  openOperation({
    title: 'Agregar riesgo',
    copy: `Vincula un inmueble a la póliza colectiva #${id}.`,
    action: 'Confirmar alta',
    path: `/polizas/${id}/riesgos`,
    policyId: id,
    success: 'Riesgo agregado',
    input: { type: 'text', label: 'Referencia del inmueble', maxlength: '120' },
    body: input => ({ referenciaInmueble: input.value.trim() })
  });
}

ui['operation-form'].addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !operation) return;
  const config = operation;
  const body = config.body?.(ui['operation-value']);
  if (body?.referenciaInmueble === '') {
    ui['operation-error'].hidden = false;
    ui['operation-error'].textContent = 'Escribe una referencia para el inmueble.';
    ui['operation-value'].focus();
    return;
  }

  busy = true;
  ui['submit-operation'].disabled = true;
  ui['close-operation'].disabled = true;
  ui['operation-error'].hidden = true;

  try {
    const result = await api(config.path, 'POST', body);
    trace(config.path, result);
    ui.operation.close();
    notify('success', config.success, `Póliza #${config.policyId} · HTTP ${result.status}.`);
    await loadPolicies(config.policyId);
  } catch (error) {
    trace(config.path, error);
    ui['operation-error'].hidden = false;
    ui['operation-error'].textContent = errorMessage(error);
  } finally {
    busy = false;
    ui['submit-operation'].disabled = false;
    ui['close-operation'].disabled = false;
  }
});

ui.operation.addEventListener('cancel', event => {
  if (busy) event.preventDefault();
});
ui.operation.addEventListener('close', () => { operation = null; });
ui['close-operation'].addEventListener('click', () => ui.operation.close());
ui.renew.addEventListener('click', renewal);
ui.cancel.addEventListener('click', cancellation);
ui['add-risk'].addEventListener('click', newRisk);

ui['key-form'].addEventListener('submit', event => {
  event.preventDefault();
  apiKey = ui['api-key'].value;
  ui['key-form'].closest('details').open = false;
  ui.notice.hidden = true;
  ui.trace.hidden = true;
  loadPolicies();
});
ui.refresh.addEventListener('click', () => {
  ui.notice.hidden = true;
  loadPolicies();
});
ui['refresh-dashboard'].addEventListener('click', () => loadPolicies());
ui['filter-type'].addEventListener('change', () => loadPolicies(null, false));
ui['filter-status'].addEventListener('change', () => loadPolicies(null, false));
ui['previous-page'].addEventListener('click', () => changePage(-1));
ui['next-page'].addEventListener('click', () => changePage(1));

for (const card of overviewCards) {
  card.addEventListener('click', () => {
    ui['filter-type'].value = '';
    ui['filter-status'].value = card.dataset.overviewStatus;
    window.location.hash = 'polizas';
    renderView();
    ui['page-title'].focus({ preventScroll: true });
    loadPolicies(null, false);
  });
}

window.addEventListener('hashchange', () => {
  renderView();
  window.scrollTo(0, 0);
});
renderView();
loadPolicies();
