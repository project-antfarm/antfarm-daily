import { load, save, addItem, toggleItem, removeItem, todayKey, getDay, MAX_PRIORITIES } from './state.js';

const dateHeading = document.getElementById('today-date');
const listEls = {
  priorities: document.getElementById('priorities-list'),
  tasks: document.getElementById('tasks-list'),
};
const emptyEls = {
  priorities: document.getElementById('priorities-empty'),
  tasks: document.getElementById('tasks-empty'),
};
const forms = {
  priorities: document.getElementById('priority-form'),
  tasks: document.getElementById('task-form'),
};
const inputs = {
  priorities: document.getElementById('priority-input'),
  tasks: document.getElementById('task-input'),
};
const limitMsg = document.getElementById('priority-limit-msg');

const key = todayKey();
let state = load();

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderItem(list, item, index) {
  const li = document.createElement('li');
  li.className = 'item' + (item.completed ? ' is-complete' : '');
  li.dataset.id = item.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.setAttribute('aria-pressed', String(item.completed));
  toggle.addEventListener('click', () => {
    state = toggleItem(state, key, list, item.id);
    save(state);
    render();
  });

  if (list === 'priorities') {
    const badge = document.createElement('span');
    badge.className = 'item-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = String(index + 1);
    toggle.appendChild(badge);
  }

  const check = document.createElement('span');
  check.className = 'item-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = item.completed ? '✓' : '';
  toggle.appendChild(check);

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = item.text;
  toggle.appendChild(text);

  const status = document.createElement('span');
  status.className = 'sr-only';
  status.textContent = item.completed ? ' (completed)' : ' (not completed)';
  toggle.appendChild(status);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'item-delete';
  del.setAttribute('aria-label', `Delete "${item.text}"`);
  del.textContent = '✕';
  del.addEventListener('click', () => {
    if (!window.confirm(`Delete "${item.text}"? This cannot be undone.`)) return;
    state = removeItem(state, key, list, item.id);
    save(state);
    render();
  });

  li.append(toggle, del);
  return li;
}

function render() {
  dateHeading.textContent = formatToday();
  const day = getDay(state, key);

  for (const list of ['priorities', 'tasks']) {
    const items = day[list];
    listEls[list].innerHTML = '';
    emptyEls[list].hidden = items.length > 0;
    items.forEach((item, index) => listEls[list].appendChild(renderItem(list, item, index)));
  }

  const atLimit = day.priorities.length >= MAX_PRIORITIES;
  limitMsg.hidden = !atLimit;
  inputs.priorities.disabled = atLimit;
}

function handleSubmit(list) {
  return (event) => {
    event.preventDefault();
    const input = inputs[list];
    const result = addItem(state, key, list, input.value);
    if (result.error === 'limit') {
      limitMsg.hidden = false;
      return;
    }
    if (result.error === 'empty') return;
    state = result.state;
    save(state);
    input.value = '';
    render();
    input.focus();
  };
}

forms.priorities.addEventListener('submit', handleSubmit('priorities'));
forms.tasks.addEventListener('submit', handleSubmit('tasks'));

render();
