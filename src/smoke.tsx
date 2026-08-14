import React from 'react';
/**
 * 화면 렌더링 점검
 * 각 화면이 오류 없이 그려지는지, 교과서 값이 화면에 실제로 나타나는지 확인한다.
 * 실행:  npx tsx src/smoke.tsx
 */
import { renderToString } from 'react-dom/server';
import { Home } from './experiments/Home';
import { ProblemTreeScreen } from './experiments/search/ProblemTreeScreen';
import { SearchLabScreen } from './experiments/search/SearchLabScreen';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  통과  ${name}`);
  } else {
    fail += 1;
    console.log(`  실패  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

function render(name: string, el: React.ReactElement): string {
  try {
    const html = renderToString(el);
    check(`${name} 렌더링`, html.length > 500, `길이 ${html.length}`);
    return html;
  } catch (err) {
    check(`${name} 렌더링`, false, String(err));
    return '';
  }
}

console.log('\n화면 렌더링 점검');
console.log('─'.repeat(64));

const noop = () => {};

render('홈', <Home onOpen={noop} />);

const tree = render(
  '1-1 문제를 트리로 표현하기',
  <ProblemTreeScreen mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수 표시', tree.includes('27~29쪽'));
// 처음 열면 단계 1(상태 정의)이다. 간선 정의 버튼은 단계 2부터 나타난다.
// React 는 텍스트 노드 사이에 주석을 넣으므로 '단계 1' 처럼 이어 붙은 검사는 하지 않는다.
check('단계 1 상태 정의로 시작', tree.includes('상태 정의'));
check('휴리스틱값 h(n) 표시', tree.includes('휴리스틱값 h(n)'));

const bfs = render(
  '1-2 너비 우선 탐색',
  <SearchLabScreen method="bfs" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수 표시', bfs.includes('30~31쪽'));
check('비교표에 세 알고리즘', ['너비 우선 탐색', '균일 비용 탐색', 'A* 탐색'].every((m) => bfs.includes(m)));
check('너비 우선 경로 a → b → e', bfs.includes('a → b → e'));

const ucs = render(
  '1-3 균일 비용 탐색',
  <SearchLabScreen method="ucs" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('오픈 리스트 표시', ucs.includes('오픈 리스트'));
check('닫힌 리스트 표시', ucs.includes('닫힌 리스트'));
check('간선 비용 편집 b–d', ucs.includes('b') && ucs.includes('모든 비용을 1로'));
check('균일 비용 경로 a → c → d → e', ucs.includes('a → c → d → e'));

const astar = render(
  '1-4 A* 탐색',
  <SearchLabScreen method="astar" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('f(n) = g(n) + h(n) 표시', astar.includes('f(n) = g(n) + h(n)'));
check('휴리스틱 편집란', astar.includes('휴리스틱값을 모두 0으로'));
check('A*도 같은 경로', astar.includes('a → c → d → e'));

const teacher = render(
  '1-4 A* 탐색 (교사용 보기)',
  <SearchLabScreen method="astar" mode="free" onModeChange={noop} teacherMode />,
);
check('교사용 발문 표시', teacher.includes('교사 발문'));
check('교사용 오개념 표시', teacher.includes('예상 오개념'));
check('빈칸 이동 순서 안내', teacher.includes('위 → 아래 → 왼쪽 → 오른쪽'));

const guided = render(
  '1-2 (안내 실험 모드)',
  <SearchLabScreen method="bfs" mode="guided" onModeChange={noop} teacherMode={false} />,
);
check('예상 먼저 안내 문구', guided.includes('먼저 고른 뒤에 실행'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));
if (fail > 0) process.exitCode = 1;
