import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * AI LAB 빌드 설정
 *
 * base 경로만 바꾸면 어디에나 배포할 수 있습니다.
 *
 *   1) 주소의 최상위에 올리는 경우 (예: https://ai-lab.우리학교.kr/)
 *      base: '/'                     ← 지금 설정
 *
 *   2) GitHub Pages 처럼 하위 폴더에 올리는 경우
 *      저장소 이름이 ai-lab 이면  base: '/ai-lab/'
 *
 *   3) USB 나 공유 폴더에서 index.html 을 바로 여는 경우
 *      base: './'                    ← 서버 없이 파일만으로 실행됩니다
 *
 * 빌드하면 dist 폴더에 정적 파일만 생성됩니다. 서버 프로그램이 필요 없습니다.
 */
export default defineConfig({
  base: '/AI-Lab/',
  plugins: [react()],
  build: {
    // 학교의 오래된 크롬북까지 고려해 여유 있게 잡았습니다
    target: 'es2020',
    outDir: 'dist',
  },
});
