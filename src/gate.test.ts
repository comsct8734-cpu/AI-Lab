/**
 * 안내 실험 잠금 조건 점검
 * 실행:  npx tsx src/gate.test.ts
 *
 * 학생이 '예상하기'에 적은 내용이 실행 버튼의 잠금을 실제로 푸는지 확인한다.
 * 이 조건이 화면 두 곳에서 따로 계산되면 안 되므로, 규칙 자체를 여기서 검증한다.
 */

/** 실행 버튼이 열리는 조건 — SearchLabScreen 및 InquiryPanel 과 같은 규칙 */
function canRun(choice: number | null, why: string): boolean {
  const bytes = new TextEncoder().encode(why.trim()).length;
  return choice !== null && bytes >= 3;
}

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
    console.log(`  통과  ${name}`);
  } else {
    fail += 1;
    console.log(`  실패  ${name}  기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
  }
}

console.log('\n안내 실험 잠금 조건');
console.log('─'.repeat(64));

check('아무것도 안 함 → 잠김', canRun(null, ''), false);
check('보기만 고름 → 잠김', canRun(1, ''), false);
check('이유만 적음 → 잠김', canRun(null, '더 복잡해질 것 같다'), false);
check('보기 + 한글 한 글자(3바이트) → 열림', canRun(1, '음'), true);
check('보기 + 영문 3글자(3바이트) → 열림', canRun(0, 'abc'), true);
check('보기 + 영문 2글자(2바이트) → 잠김', canRun(0, 'ab'), false);
check('보기 + 공백만 → 잠김', canRun(2, '   '), false);
check('보기 + 앞뒤 공백 있는 한 글자 → 열림', canRun(2, '  네  '), true);
check('보기 0번(첫 번째)도 유효', canRun(0, '비용을 보지 않기 때문'), true);
check('보기 + 긴 문장 → 열림', canRun(1, '간선 수가 적은 경로를 먼저 찾기 때문이다'), true);

console.log(`\n${'═'.repeat(64)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));
if (fail > 0) process.exitCode = 1;
