// Single source of truth for every user-facing string, for the active
// language, and for the locale tag used by every date/time format call.
// Language identifiers double as Intl locale tags ('pt-BR', 'en-US') so no
// separate locale-mapping table is needed: whatever `getLang()` returns is
// both the catalogue key and the argument every `toLocaleDateString` call
// site passes straight through.

const ptBR = {
  title: 'Hoje — A.N.T.F.A.R.M. Diário',

  dayToday: 'Hoje',
  dayViewing: 'Visualizando',
  prevDay: 'Dia anterior',
  nextDay: 'Próximo dia',
  weekStrip: 'Semana',
  weekDayToday: ', hoje',
  weekDayHasWork: ', com trabalho planejado',
  prevWeek: 'Semana anterior',
  nextWeek: 'Próxima semana',
  jumpDateLabel: 'Ir para uma data',

  langSwitchLabel: 'Idioma',

  prioritiesHeading: 'Prioridades',
  prioritiesHint: 'Até 3',
  prioritiesEmpty: 'Nenhuma prioridade ainda — o que mais importa hoje?',
  priorityInputLabel: 'Adicionar uma prioridade',
  priorityInputPlaceholder: 'Adicionar uma prioridade…',
  priorityLimitMsg: 'Você já tem 3 prioridades hoje. Conclua ou remova uma primeiro.',

  tasksHeading: 'Tarefas',
  tasksEmpty: 'Nenhuma tarefa ainda — adicione o que mais precisa ser feito.',
  taskInputLabel: 'Adicionar uma tarefa',
  taskInputPlaceholder: 'Adicionar uma tarefa…',

  commitmentsHeading: 'Compromissos',
  commitmentsEmpty: 'Nenhum compromisso agendado ainda.',
  commitmentTimeLabel: 'Horário do compromisso',
  commitmentInputLabel: 'Adicionar um compromisso',
  commitmentInputPlaceholder: 'Adicionar um compromisso…',
  commitmentMsg: 'Um compromisso precisa de um horário e uma descrição.',

  notesHeading: 'Notas',
  notesInputLabel: 'Notas do dia',
  notesInputPlaceholder: 'Algum contexto sobre este dia…',

  add: 'Adicionar',
  itemDeleteLabel: 'Excluir "{text}"',
  itemDeleteConfirm: 'Excluir "{text}"? Esta ação não pode ser desfeita.',
  itemCompleted: ' (concluído)',
  itemNotCompleted: ' (não concluído)',

  unfinishedHeading: 'Pendências',
  unfinishedMsg: 'Este dia já tem 3 prioridades. Conclua ou remova uma antes de mover outra para cá.',
  unfinishedNone: 'Nada pendente — você está em dia.',
  unfinishedOne: '{count} item pendente de dias anteriores.',
  unfinishedMany: '{count} itens pendentes de dias anteriores.',
  unfinishedOrigin: 'Ontem',
  unfinishedComplete: 'Concluir',
  unfinishedCompleteLabel: 'Concluir "{text}" de {origin}',
  unfinishedMove: 'Trazer para este dia',
  unfinishedMoveLabel: 'Trazer "{text}" de {origin} para este dia',

  weekHeading: 'Esta semana',
  weekHeadingOf: 'Semana de {date}',
  weekGoalsHeading: 'Metas',
  weekGoalsEmpty: 'Nenhuma meta ainda — o que você quer desta semana?',
  goalInputLabel: 'Adicionar uma meta para a semana',
  goalInputPlaceholder: 'Adicionar uma meta para a semana…',
  goalMsg: 'Uma meta precisa de algum texto.',
  weekProgressNone: 'Nenhum trabalho planejado ainda esta semana.',
  weekProgressOne: '{completed} de {total} concluído esta semana',
  weekProgressMany: '{completed} de {total} concluídos esta semana',

  upcomingHeading: 'Próximos prazos',
  deadlinesEmpty: 'Nenhum prazo ainda — adicione algo com data de vencimento.',
  deadlineInputLabel: 'Adicionar um prazo',
  deadlineInputPlaceholder: 'Adicionar um prazo…',
  deadlineDueLabel: 'Data de vencimento',
  deadlineMsg: 'Um prazo precisa de texto e uma data de vencimento válida.',

  deadlineOverdue: 'Atrasado',
  deadlineDueToday: 'Vence hoje',
  deadlineDueTomorrow: 'Vence amanhã',
  deadlineDueInDays: 'Vence em {days} dias',
  deadlinesSummaryNone: 'Nenhum prazo ainda.',
  deadlinesSummaryClear: 'Nada vencendo em breve.',
  deadlinesSummaryOverdueOne: '{count} atrasado',
  deadlinesSummaryOverdueMany: '{count} atrasados',
  deadlinesSummaryDueSoon: '{count} vencendo em breve',
};

// Natural English, not a word-for-word translation of the pt-BR catalogue.
// Must carry exactly the same key set as `ptBR` — pinned by the key-parity
// test in tests/app.spec.js.
const enUS = {
  title: 'Today — A.N.T.F.A.R.M. Daily',

  dayToday: 'Today',
  dayViewing: 'Viewing',
  prevDay: 'Previous day',
  nextDay: 'Next day',
  weekStrip: 'Week',
  weekDayToday: ', today',
  weekDayHasWork: ', has planned work',
  prevWeek: 'Previous week',
  nextWeek: 'Next week',
  jumpDateLabel: 'Jump to a date',

  langSwitchLabel: 'Language',

  prioritiesHeading: 'Priorities',
  prioritiesHint: 'Up to 3',
  prioritiesEmpty: 'No priorities yet — what matters most today?',
  priorityInputLabel: 'Add a priority',
  priorityInputPlaceholder: 'Add a priority…',
  priorityLimitMsg: 'You already have 3 priorities today. Finish or remove one first.',

  tasksHeading: 'Tasks',
  tasksEmpty: 'No tasks yet — add what needs doing most.',
  taskInputLabel: 'Add a task',
  taskInputPlaceholder: 'Add a task…',

  commitmentsHeading: 'Commitments',
  commitmentsEmpty: 'No commitments scheduled yet.',
  commitmentTimeLabel: 'Commitment time',
  commitmentInputLabel: 'Add a commitment',
  commitmentInputPlaceholder: 'Add a commitment…',
  commitmentMsg: 'A commitment needs a time and a description.',

  notesHeading: 'Notes',
  notesInputLabel: 'Notes for the day',
  notesInputPlaceholder: 'Any context about this day…',

  add: 'Add',
  itemDeleteLabel: 'Delete "{text}"',
  itemDeleteConfirm: 'Delete "{text}"? This action cannot be undone.',
  itemCompleted: ' (completed)',
  itemNotCompleted: ' (not completed)',

  unfinishedHeading: 'Unfinished',
  unfinishedMsg: 'This day already has 3 priorities. Finish or remove one before moving another here.',
  unfinishedNone: "Nothing pending — you're all caught up.",
  unfinishedOne: '{count} item pending from previous days.',
  unfinishedMany: '{count} items pending from previous days.',
  unfinishedOrigin: 'Yesterday',
  unfinishedComplete: 'Finish',
  unfinishedCompleteLabel: 'Finish "{text}" from {origin}',
  unfinishedMove: 'Bring to this day',
  unfinishedMoveLabel: 'Bring "{text}" from {origin} to this day',

  weekHeading: 'This week',
  weekHeadingOf: 'Week of {date}',
  weekGoalsHeading: 'Goals',
  weekGoalsEmpty: 'No goals yet — what do you want from this week?',
  goalInputLabel: 'Add a goal for the week',
  goalInputPlaceholder: 'Add a goal for the week…',
  goalMsg: 'A goal needs some text.',
  weekProgressNone: 'No work planned yet this week.',
  weekProgressOne: '{completed} of {total} done this week',
  weekProgressMany: '{completed} of {total} done this week',

  upcomingHeading: 'Upcoming deadlines',
  deadlinesEmpty: 'No deadlines yet — add something with a due date.',
  deadlineInputLabel: 'Add a deadline',
  deadlineInputPlaceholder: 'Add a deadline…',
  deadlineDueLabel: 'Due date',
  deadlineMsg: 'A deadline needs text and a valid due date.',

  deadlineOverdue: 'Overdue',
  deadlineDueToday: 'Due today',
  deadlineDueTomorrow: 'Due tomorrow',
  deadlineDueInDays: 'Due in {days} days',
  deadlinesSummaryNone: 'No deadlines yet.',
  deadlinesSummaryClear: 'Nothing due soon.',
  deadlinesSummaryOverdueOne: '{count} overdue',
  deadlinesSummaryOverdueMany: '{count} overdue',
  deadlinesSummaryDueSoon: '{count} due soon',
};

const catalogues = { 'pt-BR': ptBR, 'en-US': enUS };

export { catalogues };

export const LANG_STORAGE_KEY = 'antfarm.daily.lang';

// Never derived from navigator.language — GOAL.md names pt-BR as the
// default outright, so an absent or unrecognised stored value always falls
// back to it rather than to whatever the visitor's browser is configured
// with.
function readStoredLang(storage) {
  try {
    const raw = storage.getItem(LANG_STORAGE_KEY);
    return raw in catalogues ? raw : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

let activeLang = readStoredLang(globalThis.localStorage);

// The active language the whole app reads at call time — `t()` and
// `getLang()` resolve against whichever catalogue this points at, not one
// captured when the module first loaded, so a runtime switch changes every
// subsequent call without a page reload.
export function getLang() {
  return activeLang;
}

export function setLang(lang, storage = globalThis.localStorage) {
  if (!(lang in catalogues)) return;
  activeLang = lang;
  try {
    storage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Storage unavailable (private browsing, quota) — the session still
    // gets the switch, it just won't persist across a reload.
  }
}

// Looks up `key` in the active catalogue and fills in `{name}` placeholders
// from `params`. No plural rules or ICU-style syntax: callers pick the
// already-inflected key (`unfinishedOne` vs `unfinishedMany`) themselves,
// which is all the plural handling these catalogues' strings need. A key
// missing from the active catalogue throws rather than rendering `undefined`
// into the page — the key-parity test relies on this to catch a string
// added to one language and forgotten in the other.
export function t(key, params) {
  const template = catalogues[activeLang][key];
  if (typeof template !== 'string') {
    throw new Error(`i18n: missing key "${key}" for locale "${activeLang}"`);
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
