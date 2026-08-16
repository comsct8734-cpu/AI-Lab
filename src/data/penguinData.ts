import raw from './penguins.json' with { type: 'json' };
import {
  handleMissing,
  outlierBounds,
  type Field,
  type MissingStrategy,
  type Row,
} from '../core/stats';

/**
 * 데이터 실험실이 공유하는 데이터와 전처리 상태
 * 교과서 Ⅱ-01 인쇄 72~81쪽
 *
 * 데이터 관찰 → 결측치·이상치 → 정규화 → 최근접 이웃 네 화면이
 * 같은 데이터를 이어서 쓴다. 앞 화면에서 한 전처리가 뒤 화면에 그대로 반영된다.
 * 교과서 78~84쪽의 '단계 1~4' 구조를 그대로 따른 것이다.
 */

export const PENGUIN_FIELDS: Field[] = [
  { key: 'species', label: '종', kind: 'categorical' },
  { key: 'island', label: '서식지', kind: 'categorical' },
  { key: 'culmen_length_mm', label: '부리 길이', kind: 'numeric', unit: 'mm' },
  { key: 'culmen_depth_mm', label: '부리 깊이', kind: 'numeric', unit: 'mm' },
  { key: 'flipper_length_mm', label: '날개 길이', kind: 'numeric', unit: 'mm' },
  { key: 'body_mass_g', label: '체질량', kind: 'numeric', unit: 'g' },
  { key: 'sex', label: '성별', kind: 'categorical' },
];

export const NUMERIC_FIELDS = PENGUIN_FIELDS.filter((f) => f.kind === 'numeric');

export const SPECIES_LABEL: Record<string, string> = {
  Adelie: '아델리펭귄',
  Chinstrap: '턱끈펭귄',
  Gentoo: '젠투펭귄',
};

export const SPECIES_ORDER = ['Adelie', 'Chinstrap', 'Gentoo'];

/** 색만으로 구분하지 않도록 모양을 함께 쓴다 (설계서 1-3) */
export const SPECIES_STYLE: Record<string, { color: string; shape: 'circle' | 'triangle' | 'square' }> = {
  Adelie: { color: '#1f6fb2', shape: 'circle' },
  Chinstrap: { color: '#c25a1f', shape: 'triangle' },
  Gentoo: { color: '#2e7d4f', shape: 'square' },
};

export const RAW_ROWS = raw as Row[];

export interface Pipeline {
  missing: MissingStrategy;
  /** 성별 칸의 '.' 처럼 값이 잘못 들어간 행을 제거할지 (교과서 81쪽) */
  removeBadSex: boolean;
  /** 종별 상자그림에서 벗어난 체질량 이상치를 제거할지 (교과서 75쪽) */
  removeMassOutliers: boolean;
}

export const DEFAULT_PIPELINE: Pipeline = {
  missing: 'keep',
  removeBadSex: false,
  removeMassOutliers: false,
};

export interface PipelineStep {
  label: string;
  count: number;
  removed: number;
}

export interface PipelineResult {
  rows: Row[];
  steps: PipelineStep[];
}

/**
 * 전처리를 순서대로 적용하고, 각 단계에서 데이터가 몇 개 남았는지 기록한다.
 * 화면 위쪽의 '전처리 이력'에 그대로 표시된다.
 */
export function runPipeline(p: Pipeline): PipelineResult {
  const steps: PipelineStep[] = [{ label: '원본', count: RAW_ROWS.length, removed: 0 }];
  let rows = RAW_ROWS;

  if (p.missing !== 'keep') {
    const before = rows.length;
    rows = handleMissing(rows, PENGUIN_FIELDS, p.missing);
    steps.push({
      label: p.missing === 'drop' ? '결측치 행 제거' : '결측치 대체',
      count: rows.length,
      removed: before - rows.length,
    });
  }

  if (p.removeBadSex) {
    const before = rows.length;
    rows = rows.filter((r) => r.sex !== '.');
    steps.push({ label: '이상치 제거 (성별)', count: rows.length, removed: before - rows.length });
  }

  if (p.removeMassOutliers) {
    const before = rows.length;
    // 종별로 나누어 상자그림 범위를 구한다.
    // 전체를 한 덩어리로 보면 젠투가 원래 무거워서 이상치가 드러나지 않는다.
    const kept = new Set<Row>();
    for (const species of SPECIES_ORDER) {
      const group = rows.filter((r) => r.species === species);
      const mass = group
        .map((r) => r.body_mass_g)
        .filter((v): v is number => typeof v === 'number');
      if (mass.length < 4) {
        group.forEach((r) => kept.add(r));
        continue;
      }
      const b = outlierBounds(mass);
      for (const r of group) {
        const m = r.body_mass_g;
        if (typeof m !== 'number' || (m >= b.lower && m <= b.upper)) kept.add(r);
      }
    }
    rows = rows.filter((r) => kept.has(r));
    steps.push({
      label: '이상치 제거 (체질량)',
      count: rows.length,
      removed: before - rows.length,
    });
  }

  return { rows, steps };
}

/** 결측치가 없는 행만 (그래프를 그릴 때 쓴다) */
export function completeRows(rows: Row[]): Row[] {
  return rows.filter((r) =>
    NUMERIC_FIELDS.every((f) => typeof r[f.key] === 'number'),
  );
}

export function fieldOf(key: string): Field {
  return PENGUIN_FIELDS.find((f) => f.key === key) ?? PENGUIN_FIELDS[0];
}

export function speciesName(key: unknown): string {
  return typeof key === 'string' ? (SPECIES_LABEL[key] ?? key) : '알 수 없음';
}
