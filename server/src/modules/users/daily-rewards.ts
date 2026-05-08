import type { PublicDailyTask } from './user.model';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const DAILY_LOGIN_REWARD = 200;
export const DAILY_RELEVANT_HISTORY_WINDOW_MS = 48 * 60 * 60 * 1000;

export type DailyTaskKey = 'play-1-round' | 'play-3-rounds' | 'win-1-round';

interface DailyTaskDefinition {
  key: DailyTaskKey;
  title: string;
  description: string;
  reward: number;
  target: number;
  metric: 'plays' | 'wins';
}

export const DAILY_TASKS: DailyTaskDefinition[] = [
  {
    key: 'play-1-round',
    title: 'Warmup round',
    description: 'Play 1 round in any game today.',
    reward: 100,
    target: 1,
    metric: 'plays'
  },
  {
    key: 'play-3-rounds',
    title: 'Table grinder',
    description: 'Play 3 rounds today.',
    reward: 200,
    target: 3,
    metric: 'plays'
  },
  {
    key: 'win-1-round',
    title: 'Hit a win',
    description: 'Finish 1 round with a positive result today.',
    reward: 300,
    target: 1,
    metric: 'wins'
  }
];

export const isDailyTaskKey = (value: string): value is DailyTaskKey =>
  DAILY_TASKS.some((task) => task.key === value);

export const getDailyDateKey = (date: Date = new Date()): string => dayFormatter.format(date);

export const isSameDailyDate = (date: Date, dayKey: string): boolean => getDailyDateKey(date) === dayKey;

export const buildDailyTaskStates = (
  history: Array<{ createdAt: Date; balanceChange: number }>,
  claimedTaskKeys: Set<string>,
  dayKey: string
): PublicDailyTask[] => {
  const todayHistory = history.filter((entry) => isSameDailyDate(entry.createdAt, dayKey));
  const plays = todayHistory.length;
  const wins = todayHistory.filter((entry) => entry.balanceChange > 0).length;

  return DAILY_TASKS.map((task) => {
    const rawProgress = task.metric === 'plays' ? plays : wins;

    return {
      key: task.key,
      title: task.title,
      description: task.description,
      reward: task.reward,
      progress: Math.min(rawProgress, task.target),
      target: task.target,
      completed: rawProgress >= task.target,
      claimed: claimedTaskKeys.has(task.key)
    };
  });
};
