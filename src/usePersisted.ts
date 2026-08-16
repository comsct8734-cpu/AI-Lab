import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save } from './storage';

/**
 * 저장 정책(session 기본 / device는 명시적 선택)을 따르는 상태 훅.
 *
 * 같은 키를 여러 화면 조각이 함께 쓸 수 있어야 한다.
 * 예를 들어 '① 예상하기'의 선택은 아래쪽 탐구 패널에서 입력하지만,
 * 오른쪽 실행 버튼이 그 값을 보고 잠금을 풀어야 한다.
 * 예전에는 두 곳이 각자의 useState 를 들고 있어서, 학생이 예상을 적어도
 * 실행 버튼 쪽 값이 바뀌지 않아 버튼이 계속 잠겨 있었다.
 * 그래서 같은 키를 쓰는 훅끼리 값 변화를 알려 주도록 만들었다.
 */

type Listener = (value: unknown, from: number) => void;

const listeners = new Map<string, Set<Listener>>();
let nextId = 1;

function subscribe(key: string, fn: Listener): () => void {
  const set = listeners.get(key) ?? new Set<Listener>();
  set.add(fn);
  listeners.set(key, set);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(key);
  };
}

function notify(key: string, value: unknown, from: number) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) fn(value, from);
}

export function usePersisted<T>(key: string, initial: T) {
  const id = useRef(0);
  if (id.current === 0) id.current = nextId++;

  const [value, setValue] = useState<T>(() => load(key, initial));

  // 다른 곳에서 같은 키의 값을 바꾸면 여기도 따라 바뀐다
  useEffect(
    () =>
      subscribe(key, (v, from) => {
        if (from === id.current) return; // 내가 바꾼 것은 무시
        setValue(v as T);
      }),
    [key],
  );

  useEffect(() => {
    save(key, value);
    notify(key, value, id.current);
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset] as const;
}
