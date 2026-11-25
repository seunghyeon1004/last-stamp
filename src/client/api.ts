import type { CompleteRequest, CompleteResponse, StateResponse } from '../shared/api';

export async function fetchState(): Promise<StateResponse | null> {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return null;
    const data = (await res.json()) as StateResponse;
    return data.type === 'state' ? data : null;
  } catch {
    return null;
  }
}

export async function sendComplete(body: CompleteRequest): Promise<CompleteResponse | null> {
  try {
    const res = await fetch('/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as CompleteResponse;
  } catch {
    return null;
  }
}

/** Per-viewer convenience only: an unfinished sheet survives a reload. Never the source of truth. */
export function saveDraft(date: string, data: unknown): void {
  try {
    localStorage.setItem(`overprint:draft:${date}`, JSON.stringify(data));
  } catch {
    /* storage can be unavailable */
  }
}

export function loadDraft<T>(date: string): T | null {
  try {
    const raw = localStorage.getItem(`overprint:draft:${date}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(date: string): void {
  try {
    localStorage.removeItem(`overprint:draft:${date}`);
  } catch {
    /* ignore */
  }
}
