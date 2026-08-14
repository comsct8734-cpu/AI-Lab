import { useCallback, useEffect, useState } from 'react';
import { load, save } from './storage';

/** 저장 정책(session 기본 / device는 명시적 선택)을 따르는 상태 훅 */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial));

  useEffect(() => {
    save(key, value);
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset] as const;
}
