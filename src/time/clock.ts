export interface Clock {
  now(): Date;
}

export function createClock(now: (() => Date) | undefined): Clock {
  return {
    now: () => new Date((now ? now() : new Date()).getTime()),
  };
}
