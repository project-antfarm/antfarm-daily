// Single source of truth for every user-facing string and for the locale
// used by every date/time format call. pt-BR only for now, by design — see
// DECISIONS.md. The follow-up Issue adds an English catalogue, a switcher
// and persistence on top of this.

export const LOCALE = 'pt-BR';

const strings = {
  title: 'Hoje — A.N.T.F.A.R.M. Diário',

  dayToday: 'Hoje',
  dayViewing: 'Visualizando',
  prevDay: 'Dia anterior',
  nextDay: 'Próximo dia',
  weekStrip: 'Semana',
  weekDayToday: ', hoje',
  weekDayHasWork: ', com trabalho planejado',

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

export { strings };

// Looks up `key` and fills in `{name}` placeholders from `params`. No plural
// rules or ICU-style syntax: callers pick the already-inflected key
// (`unfinishedOne` vs `unfinishedMany`) themselves, which is all the plural
// handling this catalogue's strings need.
export function t(key, params) {
  const template = strings[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
