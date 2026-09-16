import { dateKey, loadTasks, addTask, toggleTask, deleteTask } from './storage.js';

const todayKey = dateKey();
const storage = window.localStorage;

const dateHeading = document.getElementById('today-date');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');

function formatToday(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderTask(task) {
  const item = document.createElement('li');
  item.className = 'task' + (task.completed ? ' task--completed' : '');

  const label = document.createElement('label');
  label.className = 'task__label';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task__checkbox';
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    'aria-label',
    `Mark "${task.text}" as ${task.completed ? 'not complete' : 'complete'}`
  );
  checkbox.addEventListener('change', () => {
    render(toggleTask(storage, todayKey, task.id));
  });

  const text = document.createElement('span');
  text.className = 'task__text';
  text.textContent = task.text;

  label.append(checkbox, text);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'task__delete';
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', `Delete "${task.text}"`);
  deleteButton.addEventListener('click', () => {
    render(deleteTask(storage, todayKey, task.id));
  });

  item.append(label, deleteButton);
  return item;
}

function render(tasks) {
  taskList.innerHTML = '';
  emptyState.hidden = tasks.length > 0;
  for (const task of tasks) {
    taskList.appendChild(renderTask(task));
  }
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  render(addTask(storage, todayKey, text));
  taskInput.value = '';
  taskInput.focus();
});

dateHeading.textContent = formatToday(new Date());
render(loadTasks(storage, todayKey));
