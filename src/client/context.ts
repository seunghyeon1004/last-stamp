import { context } from '@devvit/web/client';
import { isDateKey } from '../shared/daily';

/** The puzzle date stored on the post at creation, if the client context is available. */
export function postDate(): string | null {
  try {
    const d = context.postData?.date;
    return typeof d === 'string' && isDateKey(d) ? d : null;
  } catch {
    return null;
  }
}
