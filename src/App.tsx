import { useEffect, useState } from 'react';
import { AppShell, type NavItem } from './ui/AppShell';
import { Home, SEARCH_SCREENS } from './experiments/Home';
import { ProblemTreeScreen } from './experiments/search/ProblemTreeScreen';
import { SearchLabScreen } from './experiments/search/SearchLabScreen';
import type { LearnMode } from './ui/ExperimentFrame';
import { usePersisted } from './usePersisted';
import { save } from './storage';

/**
 * MVP 1 · 탐색 실험실
 *
 * 라우터 라이브러리를 쓰지 않고 주소의 해시만 읽는다.
 * 학교망에서 정적 파일로 배포할 때 서버 설정이 필요 없다.
 */

const VALID = new Set(['home', ...SEARCH_SCREENS.map((s) => s.id)]);

function readHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return VALID.has(h) ? h : 'home';
}

export default function App() {
  const [screen, setScreen] = useState<string>(readHash);
  const [mode, setMode] = usePersisted<LearnMode>('learn-mode', 'free');
  const [teacherMode, setTeacherMode] = usePersisted('teacher-mode', false);

  useEffect(() => {
    const onHash = () => setScreen(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id: string) => {
    window.location.hash = `/${id}`;
    setScreen(id);
    window.scrollTo({ top: 0 });
    if (id !== 'home') save('last-screen', id);
  };

  const nav: NavItem[] = [
    { id: 'search', label: '탐색', enabled: true },
    { id: 'data', label: '데이터', enabled: false },
    { id: 'regression', label: '회귀', enabled: false },
    { id: 'classify', label: '분류', enabled: false },
    { id: 'cluster', label: '군집', enabled: false },
    { id: 'neural', label: '신경망', enabled: false },
  ];

  const currentUnit = screen === 'home' ? null : 'search';

  const body = () => {
    if (screen === 'home') return <Home onOpen={go} />;
    if (screen === 'problem-tree')
      return (
        <ProblemTreeScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />
      );
    return (
      <SearchLabScreen
        key={screen}
        method={screen as 'bfs' | 'ucs' | 'astar'}
        mode={mode}
        onModeChange={setMode}
        teacherMode={teacherMode}
      />
    );
  };

  return (
    <AppShell
      nav={nav}
      currentUnit={currentUnit}
      onNavigate={() => go(SEARCH_SCREENS[0].id)}
      onHome={() => go('home')}
      teacherMode={teacherMode}
      onToggleTeacher={() => setTeacherMode(!teacherMode)}
    >
      {body()}

      {screen !== 'home' && (
        <div className="below" style={{ paddingTop: 0 }}>
          <section className="section-card">
            <h2>다른 실험으로 이동</h2>
            <div className="screen-list">
              {SEARCH_SCREENS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="screen-item"
                  onClick={() => go(s.id)}
                  disabled={s.id === screen}
                  style={s.id === screen ? { opacity: 0.55, cursor: 'default' } : undefined}
                >
                  <span className="screen-item__no">{s.no}</span>
                  <span>
                    {s.name}
                    <br />
                    <span className="muted">교과서 {s.textbook}</span>
                  </span>
                  {s.id === screen && <span className="screen-item__done">지금 화면</span>}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
