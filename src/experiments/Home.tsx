import { load } from '../storage';

/**
 * 홈 — 설계서 2절
 * 소개문을 읽게 하는 화면이 아니라, 지금 배우는 단원의 실험을 빨리 찾아
 * 들어가게 하는 화면이다. 클릭 두 번 안에 실험 화면에 도착해야 한다.
 */

export interface ScreenInfo {
  id: string;
  no: string;
  name: string;
  textbook: string;
}

export const SEARCH_SCREENS: ScreenInfo[] = [
  { id: 'problem-tree', no: '1-1', name: '문제를 트리로 표현하기', textbook: '27~29쪽' },
  { id: 'bfs', no: '1-2', name: '너비 우선 탐색', textbook: '30~31쪽' },
  { id: 'ucs', no: '1-3', name: '균일 비용 탐색', textbook: '32~33쪽' },
  { id: 'astar', no: '1-4', name: 'A* 탐색과 세 알고리즘 비교', textbook: '34~37쪽' },
];

interface Unit {
  id: string;
  unit: string;
  name: string;
  pages: string;
  count: number;
  ready: boolean;
}

const UNITS: Unit[] = [
  { id: 'search', unit: 'Ⅰ-02', name: '탐색 실험실', pages: '26~41쪽', count: 4, ready: true },
  { id: 'data', unit: 'Ⅱ-01', name: '데이터 실험실', pages: '60~87쪽', count: 4, ready: false },
  { id: 'regression', unit: 'Ⅱ-02', name: '회귀 실험실', pages: '96~105쪽', count: 2, ready: false },
  { id: 'classify', unit: 'Ⅱ-02', name: '분류 실험실', pages: '106~117쪽', count: 4, ready: false },
  { id: 'cluster', unit: 'Ⅱ-02', name: '군집 실험실', pages: '118~124쪽', count: 2, ready: false },
  { id: 'neural', unit: 'Ⅱ-03', name: '신경망 실험실', pages: '126~142쪽', count: 3, ready: false },
];

/** '발견한 사실'까지 연 실험을 완료로 본다 */
function isDone(screenId: string): boolean {
  const key = screenId === 'problem-tree' ? 'problem-tree' : `search-${screenId}`;
  return load<boolean>(`${key}:finding`, false);
}

interface Props {
  onOpen: (screenId: string) => void;
}

export function Home({ onOpen }: Props) {
  const doneCount = SEARCH_SCREENS.filter((s) => isDone(s.id)).length;
  const last = load<string | null>('last-screen', null);
  const lastInfo = SEARCH_SCREENS.find((s) => s.id === last);

  return (
    <div className="home">
      <h1>AI LAB</h1>
      <p className="home__sub">데이터로 이해하는 인공지능</p>

      <h2>교과서 단원을 고르세요</h2>
      <div className="unit-grid">
        {UNITS.map((u) => {
          const done = u.id === 'search' ? doneCount : 0;
          return (
            <button
              key={u.id}
              type="button"
              className="unit-card"
              disabled={!u.ready}
              onClick={() => u.ready && onOpen(SEARCH_SCREENS[0].id)}
            >
              <span className="unit-card__unit">
                {u.unit} · {u.pages}
              </span>
              <span className="unit-card__name">{u.name}</span>
              <span className="unit-card__meta">
                {u.ready ? `실험 ${u.count}개` : '준비 중입니다'}
              </span>
              {u.ready && (
                <span className="dots" aria-label={`${u.count}개 중 ${done}개 완료`}>
                  {'●'.repeat(done)}
                  {'○'.repeat(Math.max(0, u.count - done))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lastInfo && (
        <div className="resume">
          <span>
            이어서 하기 · <strong>{lastInfo.name}</strong>
          </span>
          <button
            type="button"
            className="btn btn--small btn--primary"
            onClick={() => onOpen(lastInfo.id)}
          >
            열기
          </button>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>탐색 실험실 — 실험 4개</h2>
      <div className="screen-list">
        {SEARCH_SCREENS.map((s) => (
          <button key={s.id} type="button" className="screen-item" onClick={() => onOpen(s.id)}>
            <span className="screen-item__no">{s.no}</span>
            <span>
              {s.name}
              <br />
              <span className="muted">교과서 {s.textbook}</span>
            </span>
            {isDone(s.id) && <span className="screen-item__done">완료</span>}
          </button>
        ))}
      </div>

      <div className="note">
        이 실험실의 계산은 모두 이 기기의 브라우저에서 실제로 수행됩니다. 미리 만들어 둔 결과를
        보여 주는 것이 아닙니다. 학생이 적은 내용은 기본적으로 브라우저를 닫으면 사라지며, 상단의
        [내 기록 지우기]로 언제든 지울 수 있습니다.
      </div>
    </div>
  );
}
