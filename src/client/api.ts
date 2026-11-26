import type { CompleteRequest, CompleteResponse, FlairResponse, ShareResponse, StateResponse } from '../shared/api';

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

export async function sendComplete(body: CompleteRequest, journeyId?: string): Promise<CompleteResponse | null> {
  try {
    const res = await fetch('/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(journeyId ? { 'x-devvit-journey-id': journeyId } : {}) },
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

export async function shareResult(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/share', { method: 'POST' });
    const data = (await res.json()) as ShareResponse | { status: 'error'; message: string };
    if (res.ok && 'type' in data) return { ok: true };
    return { ok: false, message: 'message' in data ? data.message : 'Could not comment' };
  } catch {
    return { ok: false, message: 'Could not reach the server' };
  }
}

export async function wearFlair(): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/flair', { method: 'POST' });
    const data = (await res.json()) as FlairResponse | { status: 'error'; message: string };
    if (res.ok && 'type' in data) return { ok: true, text: data.text };
    return { ok: false, message: 'message' in data ? data.message : 'Could not set flair' };
  } catch {
    return { ok: false, message: 'Could not reach the server' };
  }
}
