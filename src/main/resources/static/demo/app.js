'use strict';

const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  'connection', 'key-form', 'api-key', 'policy-count', 'refresh', 'filter-type',
  'filter-status', 'policies', 'list-empty', 'detail-title', 'detail-type', 'detail-status',
  'detail-empty', 'detail-body', 'rent', 'premium', 'term', 'renew', 'cancel', 'add-risk',
  'risk-count', 'risks', 'notice', 'notice-title', 'notice-message', 'trace', 'trace-label',
  'trace-body', 'operation', 'operation-form', 'operation-title', 'operation-copy',
  'operation-input', 'operation-label', 'operation-value', 'operation-error',
  'close-operation', 'submit-operation'
].map(id => [id, byId(id)]));

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2
});
const calendar = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });
const apiRoot = new URL('../', window.location.href);
const types = { INDIVIDUAL: 'Individual', COLECTIVA: 'Colectiva' };
const statuses = {
  ACTIVA: 'Activa', ACTIVO: 'Activo', RENOVADA: 'Renovada',
  CANCELADA: 'Cancelada', CANCELADO: 'Cancelado'
};

let apiKey = ui['api-key'].value;
let policies = [];
let selected = null;
let risks = [];
let listRequest = 0;
let riskRequest = 0;
let operation = null;
let busy = false;

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

function updateSelectedRow() {
  for (const button of ui.policies.querySelectorAll('button[data-id]')) {
    const active = Number(button.dataset.id) === selected?.id;
    button.closest('tr').classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderPolicies() {
  const rows = policies.map(policy => {
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
}

async function loadPolicies(preferredId = selected?.id) {
  const current = ++listRequest;
  const filters = new URLSearchParams();
  if (ui['filter-type'].value) filters.set('tipo', ui['filter-type'].value);
  if (ui['filter-status'].value) filters.set('estado', ui['filter-status'].value);
  const path = filters.size ? `/polizas?${filters}` : '/polizas';
  ui.refresh.disabled = true;
  connection('loading', 'Consultando API');

  try {
    const { data } = await api(path);
    if (current !== listRequest) return;
    policies = data;
    renderPolicies();
    connection('ready', 'API conectada');
    await selectPolicy(policies.find(policy => policy.id === preferredId) ?? policies[0] ?? null);
  } catch (error) {
    if (current !== listRequest) return;
    policies = [];
    renderPolicies();
    await selectPolicy(null);
    ui['list-empty'].textContent = 'No se pudieron cargar las pólizas.';
    connection('error', error.status === 401 ? 'Clave inválida' : 'API sin respuesta');
    notify('error', 'Error al consultar pólizas', errorMessage(error));
  } finally {
    if (current === listRequest) ui.refresh.disabled = false;
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
ui['filter-type'].addEventListener('change', () => loadPolicies());
ui['filter-status'].addEventListener('change', () => loadPolicies());

loadPolicies();
