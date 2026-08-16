import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clearAll, getMode, setMode } from '../storage';

/**
 * 앱 셸 — 설계서 1-1
 *
 *  · 상단 프레임은 아래로 스크롤하면 숨기고 위로 올리면 바로 보여 준다.
 *    아이패드 가로 모드에서 세로 공간 52px 을 되찾는 것이 목적이다.
 *  · 실험 머리말(ExperimentFrame)은 숨기지 않는다. 학생이 지금 무엇을 하는 중인지
 *    잃지 않아야 한다.
 *  · [맨 위로] 버튼은 400px 을 넘겨 내렸을 때만 나타난다.
 */

export interface NavItem {
  id: string;
  label: string;
  enabled: boolean;
}

interface Props {
  nav: NavItem[];
  currentUnit: string | null;
  onNavigate: (id: string) => void;
  onHome: () => void;
  teacherMode: boolean;
  onToggleTeacher: () => void;
  children: ReactNode;
}

export function AppShell({
  nav,
  currentUnit,
  onNavigate,
  onHome,
  teacherMode,
  onToggleTeacher,
  children,
}: Props) {
  const [hidden, setHidden] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      if (y > 120 && y > lastY.current + 8) setHidden(true);
      else if (y < lastY.current - 8 || y <= 120) setHidden(false);
      setShowTop(y > 400);
      lastY.current = y;
      ticking.current = false;
    };
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(update);
        ticking.current = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const handleClear = () => {
    const ok = window.confirm(
      '이 기기에 저장된 내 실험 기록을 모두 지웁니다. 되돌릴 수 없습니다. 계속할까요?',
    );
    if (!ok) return;
    clearAll();
    window.location.reload();
  };

  const handleDeviceSave = () => {
    const next = getMode() === 'device' ? 'session' : 'device';
    if (next === 'device') {
      const ok = window.confirm(
        '이 기기에 기록을 저장하면 브라우저를 닫아도 남아 있습니다.\n' +
          '여러 사람이 함께 쓰는 컴퓨터라면 수업이 끝난 뒤 [내 기록 지우기]를 눌러 주세요.\n\n계속할까요?',
      );
      if (!ok) return;
    }
    setMode(next);
    window.location.reload();
  };

  const deviceOn = getMode() === 'device';

  return (
    <>
      <header className={`topbar${hidden ? ' is-hidden' : ''}`}>
        <button type="button" className="topbar__brand" onClick={onHome}>
          AI LAB
        </button>
        <nav className="topbar__nav" aria-label="단원">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`topbar__link${currentUnit === item.id ? ' is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              disabled={!item.enabled}
              title={item.enabled ? undefined : '아직 준비 중입니다'}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar__right">
          {/*
            교사용 보기는 주소로만 켤 수 있다. (?teacher=1)
            학생 화면에는 버튼 자체가 나타나지 않는다.
            켜져 있을 때만 끄는 버튼을 보여 준다.
          */}
          {teacherMode && (
            <button type="button" className="btn btn--small btn--teacher" onClick={onToggleTeacher}>
              교사용 보기 끄기
            </button>
          )}
          <button type="button" className="btn btn--small" onClick={handleDeviceSave}>
            {deviceOn ? '이 기기에 저장 중' : '이 기기에 저장'}
          </button>
          <button type="button" className="btn btn--small" onClick={handleClear}>
            내 기록 지우기
          </button>
        </div>
      </header>

      <div className="page">{children}</div>

      <button
        type="button"
        className={`to-top${showTop ? ' is-on' : ''}`}
        onClick={toTop}
        tabIndex={showTop ? 0 : -1}
        aria-hidden={!showTop}
      >
        맨 위로
      </button>
    </>
  );
}
