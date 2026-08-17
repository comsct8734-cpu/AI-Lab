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
import { DataLabScreen } from './experiments/data/DataLabScreen';
import { KnnScreen } from './experiments/data/KnnScreen';
import { SplitLabScreen } from './experiments/regression/SplitLabScreen';
import { RegressionScreen } from './experiments/regression/RegressionScreen';
import { TreeScreen } from './experiments/classify/TreeScreen';
import { ClassifyLabScreen } from './experiments/classify/ClassifyLabScreen';
import { ClusterLabScreen } from './experiments/cluster/ClusterLabScreen';

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
check('간선 비용 편집기가 가운데 프레임에', ucs.includes('editor-strip'));
check('간선 비용 편집 버튼', ucs.includes('모든 비용을 1로'));
check('오른쪽 설정 패널이 짧아졌는가', ucs.indexOf('editor-strip') < ucs.indexOf('비교함'));
check('균일 비용 경로 a → c → d → e', ucs.includes('a → c → d → e'));

const astar = render(
  '1-4 A* 탐색',
  <SearchLabScreen method="astar" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('f(n) = g(n) + h(n) 표시', astar.includes('f(n) = g(n) + h(n)'));
check('휴리스틱 편집란이 가운데 프레임에', astar.includes('휴리스틱값 h(n)') && astar.includes('editor-strip'));
check('휴리스틱 모두 0으로 버튼', astar.includes('모두 0으로'));
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
check('예상 먼저 안내 문구', guided.includes('안내 실험 모드입니다'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));
if (fail > 0) process.exitCode = 1;

/* ── 이번 수정분 점검 ─────────────────────────────────────── */
console.log('\n수정분 점검');
console.log('─'.repeat(64));

const teacherBfs = renderToString(
  <SearchLabScreen method="bfs" mode="free" onModeChange={noop} teacherMode />,
);
check('교사용에 예시 답안 표시', teacherBfs.includes('예시 답안'));
check('① 예상하기 예시 답안', teacherBfs.includes('4~5개'));
check('⑤ 설명하기 예시 답안', teacherBfs.includes('비용을 전혀 보지 않고'));
check('학생 입력란 표시', teacherBfs.includes('이 기기의 입력'));
check('학생 입력 없을 때 안내', teacherBfs.includes('학생 각자의 답변은 그 학생의 기기에만'));

const teacherAstar = renderToString(
  <SearchLabScreen method="astar" mode="free" onModeChange={noop} teacherMode />,
);
check('A* 휴리스틱 예시 답안', teacherAstar.includes('균일 비용 탐색이 됩니다'));

const studentBfs = renderToString(
  <SearchLabScreen method="bfs" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('학생 화면에는 예시 답안 없음', !studentBfs.includes('예시 답안'));
check('학생 화면에 교사용 켜는 버튼 없음', !studentBfs.includes('교사용 보기'));
check('도전 과제 버튼 감춤', !studentBfs.includes('도전 과제'));
check('학습 모드 라벨 표시', studentBfs.includes('학습 모드'));

const guidedLock = renderToString(
  <SearchLabScreen method="ucs" mode="guided" onModeChange={noop} teacherMode={false} />,
);
check('잠금 안내가 실행 버튼 옆에', guidedLock.includes('안내 실험 모드입니다'));
check('잠금 조건 두 가지 표시', guidedLock.includes('예상 보기 하나 고르기') && guidedLock.includes('그렇게 생각한 이유 적기'));
check('예상하기로 이동 버튼', guidedLock.includes('예상하기로 이동'));
check('자유 실험으로 전환 버튼', guidedLock.includes('자유 실험으로'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));

/* ── MVP 2 데이터 실험실 ──────────────────────────────────── */
console.log('\nMVP 2 · 데이터 실험실');
console.log('─'.repeat(64));

const observe = render(
  '2-1 데이터 관찰',
  <DataLabScreen screen="observe" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', observe.includes('67~77쪽'));
check('전처리 이력 막대', observe.includes('pipeline-bar'));
check('원본 344행 표시', observe.includes('344'));
check('교육용 예제 데이터 표시', observe.includes('교육용 예제 데이터'));
check('종별 막대그래프', observe.includes('종별 데이터 개수'));
check('상관 히트맵', observe.includes('속성 사이의 상관관계'));
check('속성 유형 표시', observe.includes('수치형') && observe.includes('범주형'));

const clean = render(
  '2-2 결측치와 이상치',
  <DataLabScreen screen="clean" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('네 가지 결측치 처리', ['그대로 두기', '해당 행 제거', '평균값으로 대체', '중앙값으로 대체'].every((t) => clean.includes(t)));
check('이상치 제거 선택', clean.includes('체질량 이상치 제거'));
check('상자그림', clean.includes('상자그림'));

const norm = render(
  '2-3 정규화',
  <DataLabScreen screen="normalize" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('정규화 전후 비교', norm.includes('정규화 전') && norm.includes('정규화 후'));
check('최근접 이웃으로 연결 안내', norm.includes('최근접 이웃 실험실'));

const knn = render('2-4 최근접 이웃', <KnnScreen mode="free" onModeChange={noop} teacherMode={false} />);
check('교과서 쪽수', knn.includes('108~109, 114쪽'));
check('k 값 조절', knn.includes('k 값'));
check('거리 계산 방법', knn.includes('유클리디언') && knn.includes('맨해튼'));
check('정규화 토글', knn.includes('정규화'));
check('결정 영역 토글', knn.includes('결정 영역'));
check('결과를 개수로 설명', knn.includes('테스트 데이터') && knn.includes('올바르게'));
check('종별 정확도 표', knn.includes('종별로 얼마나 맞혔을까'));
check('훈련 · 테스트 구분 범례', knn.includes('빈 모양') && knn.includes('채운 모양'));

const knnTeacher = render(
  '2-4 (교사용 보기)',
  <KnnScreen mode="free" onModeChange={noop} teacherMode />,
);
check('교사용 예시 답안', knnTeacher.includes('예시 답안'));
check('k 예시 답안 내용', knnTeacher.includes('더 매끄러워진다'));
check('합성 데이터 안내', knnTeacher.includes('교육용 합성 데이터'));
check('교과서 168 오기 안내', knnTeacher.includes('168마리'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`MVP 1+2 최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));

/* ── MVP 3 회귀 실험실 ────────────────────────────────────── */
console.log('\nMVP 3 · 회귀 실험실');
console.log('─'.repeat(64));

const split = render(
  '3-1 훈련 데이터와 테스트 데이터',
  <SplitLabScreen screen="split" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', split.includes('94, 100쪽'));
check('비율 슬라이더', split.includes('테스트 데이터 비율'));
check('다시 나누기 버튼', split.includes('무작위로 다시 나누기'));
check('훈련·테스트 구분 범례', split.includes('채운 모양') && split.includes('빈 모양'));
check('k별 정확도 표', split.includes('k 값에 따른 정확도'));

const overfit = render(
  '3-2 과적합',
  <SplitLabScreen screen="overfit" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', overfit.includes('95쪽'));
check('두 선 범례', overfit.includes('훈련 데이터 정확도') && overfit.includes('테스트 데이터 정확도'));
check('최적 k 안내', overfit.includes('테스트 정확도가 가장 높았던 값'));

const reg = render('3-3 선형 회귀', <RegressionScreen mode="free" onModeChange={noop} teacherMode={false} />);
check('교과서 쪽수', reg.includes('96~103쪽'));
check('네 가지 지표', ['MSE', 'MAE', 'RMSE', 'R²'].every((m) => reg.includes(m)));
check('편집 모드 4개', ['보기만', '점 추가', '점 이동', '점 삭제'].every((m) => reg.includes(m)));
check('이상치 넣기 버튼', reg.includes('이상치 하나 넣기'));
check('기준값 저장 버튼', reg.includes('지금 값을 기준으로 저장'));
check('회귀식 표시', reg.includes('허리둘레 ='));
check('다중 회귀 절', reg.includes('다중 선형 회귀'));
check('회귀계수 표', reg.includes('회귀계수'));

const regTeacher = render(
  '3-3 (교사용 보기)',
  <RegressionScreen mode="free" onModeChange={noop} teacherMode />,
);
check('교사용 예시 답안', regTeacher.includes('예시 답안'));
check('R² 오해 바로잡기', regTeacher.includes('맞혔다'));
check('심화 질문', regTeacher.includes('절편만 움직입니다'));

const overfitTeacher = render(
  '3-2 (교사용 보기)',
  <SplitLabScreen screen="overfit" mode="free" onModeChange={noop} teacherMode />,
);
check('k=1 정확도 안내', overfitTeacher.includes('99.6%'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`MVP 1+2+3 최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));

/* ── MVP 4 분류 실험실 ────────────────────────────────────── */
console.log('\nMVP 4 · 분류 실험실');
console.log('─'.repeat(64));

const dtree = render('4-1 결정트리', <TreeScreen mode="free" onModeChange={noop} teacherMode={false} />);
check('교과서 쪽수', dtree.includes('107, 112쪽'));
check('최대 깊이 조절', dtree.includes('최대 깊이'));
check('지니 계수 표시', dtree.includes('지니'));
check('트리 다이어그램', dtree.includes('결정트리 구조'));
check('예/아니오 가지', dtree.includes('아니오'));
check('깊이별 비교표', dtree.includes('깊이를 바꾸면 어떻게 달라질까'));
check('정규화 불필요 안내', dtree.includes('정규화가 필요 없습니다'));

const logistic = render(
  '4-2 로지스틱 회귀',
  <ClassifyLabScreen screen="logistic" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', logistic.includes('114쪽'));
check('확률 안내', logistic.includes('확률'));
check('혼동 행렬', logistic.includes('혼동 행렬'));
check('정밀도와 재현율', logistic.includes('정밀도') && logistic.includes('재현율'));

const compare = render(
  '4-3 모델 비교실',
  <ClassifyLabScreen screen="compare" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', compare.includes('106, 115쪽'));
check('세 모델 이름', ['최근접 이웃', '결정트리', '로지스틱 회귀'].every((m) => compare.includes(m)));
check('판단이 갈리는 데이터', compare.includes('판단이 갈리는 데이터'));
check('종별 재현율 비교', compare.includes('세 모델의 종별 재현율'));
check('k 와 깊이 동시 조절', compare.includes('최근접 이웃의 k') && compare.includes('결정트리의 최대 깊이'));

const clsTeacher = render(
  '4-3 (교사용 보기)',
  <ClassifyLabScreen screen="compare" mode="free" onModeChange={noop} teacherMode />,
);
check('교사용 예시 답안', clsTeacher.includes('예시 답안'));
check('정밀도·재현율 예시 답안', clsTeacher.includes('재현율이 더 중요한 경우'));
check('거리 기반 서술 안내', clsTeacher.includes('값의 범위에 영향을 받는 모델'));

const treeTeacher = render(
  '4-1 (교사용 보기)',
  <TreeScreen mode="free" onModeChange={noop} teacherMode />,
);
check('계단 모양 예시 답안', treeTeacher.includes('축과 나란한 계단 모양'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`MVP 1~4 최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));

/* ── MVP 5 군집 실험실 ────────────────────────────────────── */
console.log('\nMVP 5 · 군집 실험실');
console.log('─'.repeat(64));

const kmeans = render(
  '5-1 k-평균 군집',
  <ClusterLabScreen screen="kmeans" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', kmeans.includes('118~122쪽'));
check('단계 실행 버튼', kmeans.includes('한 단계 실행') && kmeans.includes('자동 실행'));
check('되돌리기 버튼', kmeans.includes('한 단계 뒤로'));
check('초기 중심점 다시 뽑기', kmeans.includes('초기 중심점 다시 뽑기'));
check('중심점 이동 경로 설정', kmeans.includes('중심점 이동 경로'));
check('교과서 STEP 표기', kmeans.includes('STEP 1'));
check('타깃 없음 안내', kmeans.includes('비지도 학습'));
check('초기 중심점 비교표', kmeans.includes('초기 중심점을 바꾸면 결과가 달라질까'));
check('두 데이터 선택', kmeans.includes('쇼핑몰 고객') && kmeans.includes('카페 음료'));

const silhouette = render(
  '5-2 군집 개수 정하기',
  <ClusterLabScreen screen="silhouette" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('교과서 쪽수', silhouette.includes('123~124쪽'));
check('실루엣 막대그래프', silhouette.includes('군집 개수에 따른 실루엣 점수'));
check('가장 높은 k 표시', silhouette.includes('가장 높음'));
check('단계별 표', silhouette.includes('단계별로 무슨 일이 일어났나'));

const cluTeacher = render(
  '5-2 (교사용 보기)',
  <ClusterLabScreen screen="silhouette" mode="free" onModeChange={noop} teacherMode />,
);
check('교사용 예시 답안', cluTeacher.includes('예시 답안'));
check('정답 없음 오개념', cluTeacher.includes('군집 결과에는 정답이 있다') || cluTeacher.includes('참고 자료일 뿐'));
check('합성 데이터 안내', cluTeacher.includes('눈에 보이는 덩어리의 수'));

const kmTeacher = render(
  '5-1 (교사용 보기)',
  <ClusterLabScreen screen="kmeans" mode="free" onModeChange={noop} teacherMode />,
);
check('초기 중심점 예시 답안', kmTeacher.includes('달라질 수 있다'));
check('빈 군집 심화 질문', kmTeacher.includes('빈 군집'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`MVP 1~5 최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));

/* ── 수정분 점검 (확대·강조·범례) ─────────────────────────── */
console.log('\n수정분 점검');
console.log('─'.repeat(64));

const logi2 = renderToString(
  <ClassifyLabScreen screen="logistic" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('로지스틱 화면에 모델 선택 버튼 없음', !logi2.includes('혼동 행렬을 볼 모델'));
check('로지스틱 화면에 범례 표시', logi2.includes('빈 모양') && logi2.includes('주황 테두리'));
check('주황 테두리 뜻이 적혀 있는가', logi2.includes('잘못 분류한 테스트 데이터'));
check('로지스틱 화면에 판단 갈림 토글 없음', !logi2.includes('판단이 갈리는 데이터]'));

const cmp2 = renderToString(
  <ClassifyLabScreen screen="compare" mode="free" onModeChange={noop} teacherMode={false} />,
);
check('비교실에 판단 갈림 토글', cmp2.includes('판단이 갈리는 데이터'));
check('비교실에 모델 선택 버튼 있음', cmp2.includes('혼동 행렬을 볼 모델'));
check('주황과 보라의 차이 설명', cmp2.includes('그 모델이 잘못 분류한 테스트 데이터'));
check('비교실 범례', cmp2.includes('채운 모양'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`MVP 1~5 + 수정분 최종 · 통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));
