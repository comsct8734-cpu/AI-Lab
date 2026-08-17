import { useEffect, useState } from 'react';
import { AppShell, type NavItem } from './ui/AppShell';
import {
  CLASSIFY_SCREENS,
  CLUSTER_SCREENS,
  NEURAL_SCREENS,
  DATA_SCREENS,
  Home,
  REGRESSION_SCREENS,
  SEARCH_SCREENS,
} from './experiments/Home';
import { TreeScreen } from './experiments/classify/TreeScreen';
import { NeuralScreen } from './experiments/neural/NeuralScreen';
import { ChallengeScreen, DigitScreen, RecordScreen } from './experiments/neural/DigitScreen';
import {
  ClusterLabScreen,
  type ClusterScreenId,
} from './experiments/cluster/ClusterLabScreen';
import {
  ClassifyLabScreen,
  type ClassifyScreenId,
} from './experiments/classify/ClassifyLabScreen';
import { SplitLabScreen, type SplitScreenId } from './experiments/regression/SplitLabScreen';
import { RegressionScreen } from './experiments/regression/RegressionScreen';
import { DataLabScreen, type DataScreen } from './experiments/data/DataLabScreen';
import { KnnScreen } from './experiments/data/KnnScreen';
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

const VALID = new Set([
  'home',
  ...SEARCH_SCREENS.map((s) => s.id),
  ...DATA_SCREENS.map((s) => s.id),
  ...REGRESSION_SCREENS.map((s) => s.id),
  ...CLASSIFY_SCREENS.map((s) => s.id),
  ...CLUSTER_SCREENS.map((s) => s.id),
  ...NEURAL_SCREENS.map((s) => s.id),
  'record',
]);

const DATA_IDS = new Set(DATA_SCREENS.map((s) => s.id));
const REG_IDS = new Set(REGRESSION_SCREENS.map((s) => s.id));
const CLS_IDS = new Set(CLASSIFY_SCREENS.map((s) => s.id));
const CLU_IDS = new Set(CLUSTER_SCREENS.map((s) => s.id));
const NN_IDS = new Set(NEURAL_SCREENS.map((s) => s.id));

function readHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return VALID.has(h) ? h : 'home';
}

export default function App() {
  const [screen, setScreen] = useState<string>(readHash);
  const [mode, setMode] = usePersisted<LearnMode>('learn-mode', 'free');
  const [teacherMode, setTeacherMode] = usePersisted('teacher-mode', false);

  /**
   * 교사용 보기는 주소에 ?teacher=1 이 붙어 있을 때만 켜진다.
   * 한 번 켜면 이 브라우저에 기억되므로, 교사용 주소는 한 번만 여시면 된다.
   * 학생 화면에는 켜는 버튼이 아예 나타나지 않는다.
   *
   * 다만 이것은 '가림막'이지 잠금장치가 아니다. 정적 사이트이므로
   * 주소를 아는 학생은 켤 수 있다. 시험 문항처럼 반드시 가려야 하는 내용은
   * 이 화면에 두지 않는다.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('teacher') === '1') setTeacherMode(true);
    if (params.get('teacher') === '0') setTeacherMode(false);
  }, [setTeacherMode]);

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
    { id: 'data', label: '데이터', enabled: true },
    { id: 'regression', label: '회귀', enabled: true },
    { id: 'classify', label: '분류', enabled: true },
    { id: 'cluster', label: '군집', enabled: true },
    { id: 'neural', label: '신경망', enabled: true },
  ];

  const currentUnit =
    screen === 'home'
      ? null
      : screen === 'record'
        ? null
        : NN_IDS.has(screen)
          ? 'neural'
          : CLU_IDS.has(screen)
            ? 'cluster'
            : CLS_IDS.has(screen)
              ? 'classify'
              : REG_IDS.has(screen)
                ? 'regression'
                : DATA_IDS.has(screen)
                  ? 'data'
                  : 'search';

  const body = () => {
    if (screen === 'home') return <Home onOpen={go} />;
    if (screen === 'record') return <RecordScreen />;
    if (screen === 'neural')
      return <NeuralScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (screen === 'digit')
      return <DigitScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (screen === 'challenge')
      return <ChallengeScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (CLU_IDS.has(screen))
      return (
        <ClusterLabScreen
          key={screen}
          screen={screen as ClusterScreenId}
          mode={mode}
          onModeChange={setMode}
          teacherMode={teacherMode}
        />
      );
    if (screen === 'tree')
      return <TreeScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (CLS_IDS.has(screen))
      return (
        <ClassifyLabScreen
          key={screen}
          screen={screen as ClassifyScreenId}
          mode={mode}
          onModeChange={setMode}
          teacherMode={teacherMode}
        />
      );
    if (screen === 'regression')
      return <RegressionScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (REG_IDS.has(screen))
      return (
        <SplitLabScreen
          key={screen}
          screen={screen as SplitScreenId}
          mode={mode}
          onModeChange={setMode}
          teacherMode={teacherMode}
        />
      );
    if (screen === 'knn')
      return <KnnScreen mode={mode} onModeChange={setMode} teacherMode={teacherMode} />;
    if (DATA_IDS.has(screen))
      return (
        <DataLabScreen
          key={screen}
          screen={screen as DataScreen}
          mode={mode}
          onModeChange={setMode}
          teacherMode={teacherMode}
        />
      );
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
      onNavigate={(unit) =>
        go(
          unit === 'data'
            ? DATA_SCREENS[0].id
            : unit === 'regression'
              ? REGRESSION_SCREENS[0].id
              : unit === 'classify'
                ? CLASSIFY_SCREENS[0].id
                : unit === 'cluster'
                  ? CLUSTER_SCREENS[0].id
                  : unit === 'neural'
                    ? NEURAL_SCREENS[0].id
                    : SEARCH_SCREENS[0].id,
        )
      }
      onHome={() => go('home')}
      teacherMode={teacherMode}
      onToggleTeacher={() => setTeacherMode(!teacherMode)}
    >
      {body()}

      {screen !== 'home' && screen !== 'record' && (
        <div className="below" style={{ paddingTop: 0 }}>
          <section className="section-card">
            <h2>다른 실험으로 이동</h2>
            <div className="screen-list">
              {(NN_IDS.has(screen)
                ? NEURAL_SCREENS
                : CLU_IDS.has(screen)
                ? CLUSTER_SCREENS
                : CLS_IDS.has(screen)
                ? CLASSIFY_SCREENS
                : REG_IDS.has(screen)
                  ? REGRESSION_SCREENS
                  : DATA_IDS.has(screen)
                    ? DATA_SCREENS
                    : SEARCH_SCREENS
              ).map((s) => (
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
