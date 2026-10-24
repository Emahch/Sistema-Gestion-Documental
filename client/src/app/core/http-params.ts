import { HttpParams } from '@angular/common/http';

export function withOptionalParams(
  params: HttpParams,
  values: Record<string, string | number | null | undefined>,
): HttpParams {
  return Object.entries(values).reduce((current, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return current;
    }
    return current.set(key, String(value));
  }, params);
}
