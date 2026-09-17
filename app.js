import {
  load,
  save,
  addItem,
  toggleItem,
  removeItem,
  todayKey,
  parseKey,
  addDays,
  weekKeys,
  weekStart,
  weekProgress,
  dayHasWork,
  getDay,
  getWeek,
  addGoal,
  toggleGoal,
  removeGoal,
  MAX_PRIORITIES,
} from './state.js';

const eyebrow = document.getElementById('day-eyebrow');
const dateHeading = document.getElementById('today-date');
const weekStripEl = document.getElementById('week-strip');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const listEls = {
  priorities: document.getElementById('priorities-list'),
  tasks: document.getElementById('tasks-list'),
  commitments: document.getElementById('commitments-list'),
};
const emptyEls = {
  priorities: document.getElementById('priorities-empty'),
  tasks: document.getElementById('tasks-empty'),
  commitments: document.getElementById('commitments-empty'),
};
const forms = {
  priorities: document.getElementById('priority-form'),
  tasks: document.getElementById('task-form'),
  commitments: document.getElementById('commitment-form'),
};
const inputs = {
  priorities: document.getElementById('priority-input'),
  tasks: document.getElementById('task-input'),
  commitments: document.getElementById('commitment-input'),
};
const timeInput = document.getElementById('commitment-time-input');
const limitMsg = document.getElementById('priority-limit-msg');
const commitmentMsg = document.getElementById('commitment-msg');

const weekProgressText = document.getElementById('week-progress-text');
const weekProgressFill = document.getElementById('week-progress-fill');
const weekGoalsList = document.getElementById('week-goals-list');
const weekGoalsEmpty = document.getElementById('week-goals-empty');
const goalForm = document.getElementById('goal-form');
const goalInput = document.getElementById('goal-input');
const goalMsg = document.getElementById('goal-msg');

let state = load();

// In-memory only (never persisted): the app always opens on today. Starts
// out "following" today so a session left open across midnight keeps
// tracking the real current day until the person navigates away from it.
let selectedDay = todayKey();
let followingToday = true;

// Derives the day key at the moment it's needed (render, or a write),
// instead of caching it once — the fix for the midnight-rollover defect.
function activeDay() {
  if (followingToday) selectedDay = todayKey();
  return selectedDay;
}

function selectDay(dayKey) {
  selectedDay = dayKey;
  followingToday = dayKey === todayKey();
  render();
}

function formatDate(key) {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderItem(key, list, item, index) {
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

  if (list === 'commitments') {
    const time = document.createElement('span');
    time.className = 'item-time';
    time.textContent = item.time;
    toggle.appendChild(time);
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

function renderGoal(weekKey, item) {
  const li = document.createElement('li');
  li.className = 'item' + (item.completed ? ' is-complete' : '');
  li.dataset.id = item.id;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.setAttribute('aria-pressed', String(item.completed));
  toggle.addEventListener('click', () => {
    state = toggleGoal(state, weekKey, item.id);
    save(state);
    render();
  });

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
    state = removeGoal(state, weekKey, item.id);
    save(state);
    render();
  });

  li.append(toggle, del);
  return li;
}

function progressLabel({ completed, total }) {
  if (total === 0) return 'No planned work yet this week.';
  return `${completed} of ${total} done this week`;
}

function renderWeekPanel(dayKey) {
  const weekKey = weekStart(dayKey);
  const week = getWeek(state, weekKey);

  weekGoalsList.innerHTML = '';
  weekGoalsEmpty.hidden = week.goals.length > 0;
  week.goals.forEach((item) => weekGoalsList.appendChild(renderGoal(weekKey, item)));

  const progress = weekProgress(state, dayKey);
  weekProgressText.textContent = progressLabel(progress);
  const percent = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  weekProgressFill.style.width = `${percent}%`;
}

function renderWeekStrip(key) {
  const today = todayKey();
  weekStripEl.innerHTML = '';

  for (const dayKey of weekKeys(key)) {
    const isSelected = dayKey === key;
    const isToday = dayKey === today;
    const hasWork = dayHasWork(getDay(state, dayKey));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'week-day' + (isToday ? ' is-today' : '') + (hasWork ? ' has-work' : '');
    if (isSelected) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-current', 'date');
    }

    const date = parseKey(dayKey);
    const letter = document.createElement('span');
    letter.className = 'week-day-label';
    letter.setAttribute('aria-hidden', 'true');
    letter.textContent = date.toLocaleDateString(undefined, { weekday: 'narrow' });

    const num = document.createElement('span');
    num.className = 'week-day-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(date.getDate());

    const dot = document.createElement('span');
    dot.className = 'week-day-dot';
    dot.setAttribute('aria-hidden', 'true');

    let label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (isToday) label += ', today';
    if (hasWork) label += ', has planned work';
    btn.setAttribute('aria-label', label);

    btn.append(letter, num, dot);
    btn.addEventListener('click', () => selectDay(dayKey));
    weekStripEl.appendChild(btn);
  }
}

function render() {
  const key = activeDay();
  const isToday = key === todayKey();

  eyebrow.textContent = isToday ? 'Today' : 'Viewing';
  dateHeading.textContent = formatDate(key);

  const day = getDay(state, key);

  for (const list of ['priorities', 'tasks', 'commitments']) {
    const items = day[list];
    listEls[list].innerHTML = '';
    emptyEls[list].hidden = items.length > 0;
    items.forEach((item, index) => listEls[list].appendChild(renderItem(key, list, item, index)));
  }

  const atLimit = day.priorities.length >= MAX_PRIORITIES;
  limitMsg.hidden = !atLimit;
  inputs.priorities.disabled = atLimit;
  commitmentMsg.hidden = true;
  goalMsg.hidden = true;

  renderWeekStrip(key);
  renderWeekPanel(key);
}

function handleSubmit(list) {
  return (event) => {
    event.preventDefault();
    const key = activeDay();
    const input = inputs[list];
    const time = list === 'commitments' ? timeInput.value : undefined;
    const result = addItem(state, key, list, input.value, time);
    if (result.error === 'limit') {
      limitMsg.hidden = false;
      return;
    }
    if (result.error === 'empty') {
      if (list === 'commitments') commitmentMsg.hidden = false;
      return;
    }
    state = result.state;
    save(state);
    input.value = '';
    if (list === 'commitments') timeInput.value = '';
    render();
    input.focus();
  };
}

forms.priorities.addEventListener('submit', handleSubmit('priorities'));
forms.tasks.addEventListener('submit', handleSubmit('tasks'));
forms.commitments.addEventListener('submit', handleSubmit('commitments'));

goalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const weekKey = weekStart(activeDay());
  const result = addGoal(state, weekKey, goalInput.value);
  if (result.error === 'empty') {
    goalMsg.hidden = false;
    return;
  }
  state = result.state;
  save(state);
  goalInput.value = '';
  render();
  goalInput.focus();
});

prevBtn.addEventListener('click', () => selectDay(addDays(activeDay(), -1)));
nextBtn.addEventListener('click', () => selectDay(addDays(activeDay(), 1)));
todayBtn.addEventListener('click', () => selectDay(todayKey()));

render();
