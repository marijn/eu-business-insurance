export type Clock = {
  now: () => Date
};

export const clock: Clock = {
  now: (): Date => new Date(),
};

export function today(): string {
  return clock.now().toISOString().split('T')[0];
}

export function addDays(date: Date | string, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
