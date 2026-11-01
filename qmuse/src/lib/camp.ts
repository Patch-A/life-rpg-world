import {done, type Game} from './game';

export type CampPath = 'curiosity' | 'courage';
export const campChoices = {curiosity:'一份好奇心', courage:'一点勇气'} as const;

// Derive the scene from existing saved facts. No second reward or shadow save.
export function campProgress(state:Game) {
  const arrival = state.events.find(e => e.id === 'arrival');
  const path:CampPath|null = arrival?.choice === campChoices.curiosity ? 'curiosity'
    : arrival?.choice === campChoices.courage ? 'courage' : null;
  const arrivalTime = arrival ? Date.parse(arrival.at) : NaN;
  const echoes = state.logs.filter(log => !log.undone && !log.direction && log.unit !== '元'
    && Number.isFinite(log.value) && log.value > 0
    && state.tasks.some(task => task.id === log.taskId)
    && Number.isFinite(arrivalTime) && Date.parse(log.at) >= arrivalTime)
    .sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const tasks = state.tasks.filter(task => !task.archived && task.unit !== '元'
    && !state.goals.some(goal => goal.id === task.goalId && (goal.paused || goal.completionChoice))
    && done(state,task) < task.target);
  return {arrival,path,echo:path ? echoes[0] : undefined,tasks};
}
