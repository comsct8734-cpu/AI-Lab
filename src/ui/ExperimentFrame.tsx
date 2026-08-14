import { useEffect, useState, type ReactNode } from 'react';

/**
 * 실험 공통 프레임 — 설계서 1-1, 1-2
 *
 * 머리말(실험 이름 · 교과서 연결 · 학습 모드)은 sticky 로 항상 붙여 둔다.
 * 본문은 데이터 / 실험 화면 / 설정 3분할이고, 화면이 좁아지면
 *   1023px 이하 : 데이터 패널을 서랍으로 접는다 (아이패드 가로)
 *    833px 이하 : 세로로 쌓는다 (아이패드 세로)
 */

export type LearnMode = 'free' | 'guided' | 'challenge';

export const LEARN_MODE_LABEL: Record<LearnMode, string> = {
  free: '자유 실험',
  guided: '안내 실험',
  challenge: '도전 과제',
};

interface Props {
  title: string;
  textbook: string;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  dataPane: ReactNode;
  stage: ReactNode;
  settingsPane: ReactNode;
  below: ReactNode;
}

export function ExperimentFrame({
  title,
  textbook,
  mode,
  onModeChange,
  dataPane,
  stage,
  settingsPane,
  below,
}: Props) {
  // 좁은 화면에서 데이터 패널을 접는다. 기본은 접힌 상태.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const collapsed = narrow && !drawerOpen;

  return (
    <>
      <div className="exp-head">
        <span className="exp-head__title">{title}</span>
        <span className="textbook-link">교과서 {textbook}</span>
        {narrow && (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? '문제 설정 닫기' : '문제 설정 열기'}
          </button>
        )}
        <div className="exp-head__right">
          <div className="segmented" role="group" aria-label="학습 모드">
            {(['free', 'guided', 'challenge'] as LearnMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'is-on' : ''}
                onClick={() => onModeChange(m)}
                aria-pressed={mode === m}
              >
                {LEARN_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`exp-body${drawerOpen ? ' drawer-open' : ''}`}>
        <aside className={`pane pane--data${collapsed ? ' is-collapsed' : ''}`}>
          {dataPane}
        </aside>
        <main className="pane pane--stage">{stage}</main>
        <aside className="pane pane--settings">{settingsPane}</aside>
      </div>

      <div className="below">{below}</div>
    </>
  );
}
