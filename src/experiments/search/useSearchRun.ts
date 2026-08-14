import { useEffect, useMemo, useRef, useState } from 'react';
import { collectSteps } from '../../core/search/bestFirst';
import type {
  SearchMethod,
  SearchProblem,
  SearchResult,
  SearchStep,
} from '../../core/search/types';
import { SPEED_MS, type Speed } from '../../ui/controls';

/**
 * 단계 실행을 화면 쪽에서 다루기 위한 훅.
 *
 * 알고리즘은 제너레이터이므로 모든 단계를 미리 배열로 받아 두고,
 * 화면에서는 인덱스만 앞뒤로 움직인다. 되돌리기가 인덱스 -1 로 끝난다.
 * (설계서 1-7)
 */
export function useSearchRun<S>(
  problem: SearchProblem<S>,
  method: SearchMethod,
  maxExpanded = 3000,
) {
  const { steps, result } = useMemo(
    () => collectSteps(problem, method, { maxExpanded }),
    [problem, method, maxExpanded],
  );

  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const timer = useRef<number | null>(null);

  // 문제나 알고리즘이 바뀌면 처음으로 되돌린다
  useEffect(() => {
    setIndex(0);
    setAuto(false);
  }, [steps]);

  const atEnd = index >= steps.length - 1;

  useEffect(() => {
    if (!auto) return;
    if (atEnd) {
      setAuto(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, steps.length - 1));
    }, SPEED_MS[speed]);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [auto, atEnd, index, speed, steps.length]);

  const step: SearchStep<S> | null = steps[index] ?? null;

  return {
    steps,
    result: result as SearchResult,
    step,
    index,
    atEnd,
    auto,
    speed,
    setSpeed,
    stepForward: () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
    stepBack: () => setIndex((i) => Math.max(i - 1, 0)),
    reset: () => {
      setAuto(false);
      setIndex(0);
    },
    toggleAuto: () => setAuto((v) => !v),
    /** 학생이 한 번이라도 끝까지 실행했는가 */
    hasRun: atEnd && steps.length > 1,
  };
}
