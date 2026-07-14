export type Clock = {
  now: () => Date
};

export const SystemClock: Clock = {
  now: (): Date => new Date(),
}

export const ClockForTesting = (now: Date) => {
  let currentTime = now;

  return {
    setTime: (now: Date) => {
      currentTime = now;
    },
    now: () => currentTime,
  }
};

/**
 * @deprecated
 * @see SystemClock
 */
export const clock: Clock = {
  now: (): Date => new Date(),
};

/**
 * @deprecated This function relies on the availability of global state
 */
export function today(): string {
  return clock.now().toISOString().split('T')[0];
}

export function addDays(date: Date | string, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
