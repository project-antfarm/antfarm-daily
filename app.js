import { add, toggleComplete, remove, load, save, MAX_PRIORITIES } from './planner.js';

let state = load(window.localStorage);

const lists = {
  priorities: {
    ul: document.getElementById('priority-list'),
    form: document.getElementById('priority-form'),
    input: document.getElementById('priority-input'),
  },
  tasks: {
    ul: document.getElementById('task-list'),
    form: document.getElementById('task-form'),
    input: document.getElementById('task-input'),
  },
};

const priorityLimitNote = document.getElementById('priority-limit-note');
const priorityCount = document.getElementById('priorities-count');

document.getElementById('today-date').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function persist() {
  save(window.localStorage, state);
}

function render() {
  renderList('priorities');
  renderList('tasks');

  const atLimit = state.priorities.length >= MAX_PRIORITIES;
  priorityLimitNote.hidden = !atLimit;
  lists.priorities.input.disabled = atLimit;
  lists.priorities.form.querySelector('button').disabled = atLimit;
  priorityCount.textContent = `${state.priorities.length}/${MAX_PRIORITIES}`;
}

function renderList(listName) {
  const { ul } = lists[listName];
  ul.textContent = '';
  const items = state[listName];

  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = listName === 'priorities' ? 'No priorities set yet.' : 'No tasks yet.';
    ul.appendChild(empty);
    return;
  }

  items.forEach((item, index) => ul.appendChild(renderItem(listName, item, index)));
}

function renderItem(listName, item, index) {
  const li = document.createElement('li');
  li.className = ['item', listName === 'priorities' ? 'is-priority' : '', item.done ? 'is-done' : '']
    .filter(Boolean)
    .join(' ');

  const label = document.createElement('label');
  label.className = 'item-check';

  if (listName === 'priorities') {
    const badge = document.createElement('span');
    badge.className = 'priority-badge';
    badge.textContent = `Priority ${index + 1}`;
    label.appendChild(badge);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.done;
  checkbox.setAttribute('aria-label', `Mark "${item.text}" as ${item.done ? 'not done' : 'done'}`);
  checkbox.addEventListener('change', () => {
    state = toggleComplete(state, listName, item.id);
    persist();
    render();
  });
  label.appendChild(checkbox);

  const text = document.createElement('span');
  text.className = 'item-text';
  text.textContent = item.text;
  label.appendChild(text);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  attachDeleteConfirm(deleteBtn, listName, item.id);

  li.appendChild(label);
  li.appendChild(deleteBtn);
  return li;
}

// ponytail: confirm-on-second-click, no modal/undo history; revisit if users report accidental double-deletes.
function attachDeleteConfirm(button, listName, id) {
  let confirming = false;
  let resetTimer = null;

  button.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      button.textContent = 'Confirm delete?';
      button.classList.add('confirm');
      resetTimer = setTimeout(() => {
        confirming = false;
        button.textContent = 'Delete';
        button.classList.remove('confirm');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    state = remove(state, listName, id);
    persist();
    render();
  });
}

Object.entries(lists).forEach(([listName, { form, input }]) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = add(state, listName, input.value);
    if (!result.ok) {
      input.focus();
      return;
    }
    state = result.state;
    input.value = '';
    persist();
    render();
    input.focus();
  });
});

render();
