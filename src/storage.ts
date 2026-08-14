/**
 * 저장 정책 — 설계서 1-7
 *
 * 실습실 컴퓨터는 여러 반이 돌아가며 쓴다. 기본 저장소를 localStorage 로 두면
 * 앞 반 학생이 적은 내용이 다음 반 학생에게 그대로 보인다.
 * 그래서 기본은 sessionStorage(브라우저를 닫으면 사라짐)로 하고,
 * 학생이 [이 기기에 저장]을 직접 누른 경우에만 localStorage 를 쓴다.
 */

const PREFIX = 'ailab:';
const MODE_KEY = `${PREFIX}storage-mode`;

export type StorageMode = 'session' | 'device';

function safe(store: Storage | undefined): Storage | null {
  try {
    if (!store) return null;
    const probe = `${PREFIX}__probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    // 사파리 프라이빗 모드 등에서 저장이 막힐 수 있다. 그래도 앱은 동작해야 한다.
    return null;
  }
}

const session = safe(typeof window !== 'undefined' ? window.sessionStorage : undefined);
const device = safe(typeof window !== 'undefined' ? window.localStorage : undefined);

export function getMode(): StorageMode {
  return device?.getItem(MODE_KEY) === 'device' ? 'device' : 'session';
}

export function setMode(mode: StorageMode) {
  if (!device) return;
  if (mode === 'device') device.setItem(MODE_KEY, 'device');
  else device.removeItem(MODE_KEY);
}

function active(): Storage | null {
  return getMode() === 'device' ? device : session;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = active()?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  try {
    active()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장에 실패해도 실험은 계속할 수 있어야 한다
  }
}

/** 화면 상단의 [내 기록 지우기] */
export function clearAll() {
  for (const store of [session, device]) {
    if (!store) continue;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) store.removeItem(k);
  }
}
