import { PLATFORM_STATUS_SYSTEMS, PLATFORM_STATUS_UPDATED_AT } from './status-data.mjs';
import { CHECKS, getDisplayStatus, getReleaseState, statusTone } from './status-model.mjs';

const filterButtons = [...document.querySelectorAll('[data-filter]')];
const body = document.querySelector('#status-body');
const detail = document.querySelector('#detail-panel');
const updated = document.querySelector('#updated-at');
let activeFilter = 'all';

updated.textContent = PLATFORM_STATUS_UPDATED_AT;

function matchesFilter(system) {
  const release = getReleaseState(system.checks);
  if (activeFilter === 'all') return true;
  if (activeFilter === 'action') return release !== 'RELEASE_READY';
  return Object.values(system.checks).includes('UNVERIFIED') || Object.values(system.checks).includes('BLOCKED');
}

function badge(status) {
  return `<span class="badge badge--${statusTone(status)}">${getDisplayStatus(status)}</span>`;
}

function showDetail(system) {
  const release = getReleaseState(system.checks);
  detail.innerHTML = `
    <div class="detail__heading"><div><p class="eyebrow">${system.owner}</p><h2>${system.name}</h2></div>${badge(release)}</div>
    <p class="detail__description">${system.detail}</p>
    <div class="detail__grid">${CHECKS.map(([key, label]) => `<div><span>${label}</span>${badge(system.checks[key])}</div>`).join('')}</div>
    <section class="detail__next"><h3>次の判断</h3><p>${system.nextDecision}</p></section>
    <section class="detail__evidence"><h3>現在の根拠</h3><ul>${system.sources.map((source) => `<li>${source}</li>`).join('')}</ul></section>`;
}

function render() {
  const systems = PLATFORM_STATUS_SYSTEMS.filter(matchesFilter);
  body.innerHTML = systems.map((system) => {
    const release = getReleaseState(system.checks);
    return `<tr><th scope="row"><button class="system-button" data-system="${system.id}">${system.name}<span>${system.owner}</span></button></th>${CHECKS.slice(0, 3).map(([key]) => `<td>${badge(system.checks[key])}</td>`).join('')}<td>${badge(release)}</td></tr>`;
  }).join('');
  body.querySelectorAll('[data-system]').forEach((button) => button.addEventListener('click', () => showDetail(PLATFORM_STATUS_SYSTEMS.find((system) => system.id === button.dataset.system))));
  if (systems.length > 0) showDetail(systems[0]);
}

filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));

render();
