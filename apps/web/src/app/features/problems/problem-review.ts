import { InjectionToken } from '@angular/core';

export const POSTGRES_INTEGER_MAX = 2_147_483_647;

export interface LocalDateSource {
  getFullYear(): number;
  getMonth(): number;
  getDate(): number;
}

export const LOCAL_DATE_SOURCE = new InjectionToken<() => LocalDateSource>(
  'LOCAL_DATE_SOURCE',
  {
    providedIn: 'root',
    factory: () => () => new Date(),
  },
);

export function formatLocalDate(date: LocalDateSource): string {
  const year = `${date.getFullYear()}`.padStart(4, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
