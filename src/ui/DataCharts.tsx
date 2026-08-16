import { useMemo } from 'react';
import {
  correlation,
  outlierBounds,
  quantile,
  type Row,
} from '../core/stats';
import { SPECIES_ORDER, SPECIES_STYLE, speciesName } from '../data/penguinData';

/**
 * 데이터 실험실 그래프
 * 교과서 Ⅱ-01 인쇄 74~77·82~83쪽
 *
 * 필요한 그래프가 산점도·막대·상자그림·히트맵 네 가지뿐이고
 * '점을 누르면 원본 값이 보인다' 같은 조작이 필요해서 직접 그렸다.
 * 색만으로 구분하지 않도록 종마다 모양(●▲■)을 함께 쓴다.
 */

const W = 640;
const H = 460;
const PAD = { top: 22, right: 20, bottom: 54, left: 68 };

function shapePath(shape: string, x: number, y: number, r: number): string {
  if (shape === 'triangle') {
    return `M ${x} ${y - r * 1.15} L ${x + r} ${y + r * 0.75} L ${x - r} ${y + r * 0.75} Z`;
  }
  if (shape === 'square') {
    return `M ${x - r * 0.9} ${y - r * 0.9} h ${r * 1.8} v ${r * 1.8} h ${-r * 1.8} Z`;
  }
  return `M ${x} ${y - r} a ${r} ${r} 0 1 0 0.01 0 Z`;
}

export function SpeciesLegend() {
  return (
    <div className="legend">
      {SPECIES_ORDER.map((s) => {
        const st = SPECIES_STYLE[s];
        return (
          <span className="legend__item" key={s}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d={shapePath(st.shape, 7, 7, 5)} fill={st.color} />
            </svg>
            {speciesName(s)}
          </span>
        );
      })}
    </div>
  );
}

/* ── 산점도 ────────────────────────────────────────────────── */

interface ScatterProps {
  rows: Row[];
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  colorKey?: string;
  /** 강조할 행 (예: 잘못 분류한 데이터) */
  highlight?: Set<Row>;
  selected: Row | null;
  onSelect: (row: Row | null) => void;
  /** 정규화된 좌표로 그릴지 */
  normalized?: boolean;
}

export function ScatterPlot({
  rows,
  xKey,
  yKey,
  xLabel,
  yLabel,
  colorKey = 'species',
  highlight,
  selected,
  onSelect,
  normalized = false,
}: ScatterProps) {
  const pts = rows.filter(
    (r) => typeof r[xKey] === 'number' && typeof r[yKey] === 'number',
  );
  const xs = pts.map((r) => r[xKey] as number);
  const ys = pts.map((r) => r[yKey] as number);
  const minX = normalized ? 0 : Math.min(...xs);
  const maxX = normalized ? 1 : Math.max(...xs);
  const minY = normalized ? 0 : Math.min(...ys);
  const maxY = normalized ? 1 : Math.max(...ys);
  const padX = (maxX - minX) * 0.06 || 1;
  const padY = (maxY - minY) * 0.06 || 1;

  const sx = (v: number) =>
    PAD.left + ((v - (minX - padX)) / (maxX - minX + padX * 2)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - (minY - padY)) / (maxY - minY + padY * 2)) * (H - PAD.top - PAD.bottom);

  const ticks = (lo: number, hi: number) => {
    const out: number[] = [];
    for (let i = 0; i <= 4; i++) out.push(lo + ((hi - lo) * i) / 4);
    return out;
  };
  const fmt = (v: number) =>
    Math.abs(v) >= 1000 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);

  const r = correlation(xs, ys);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${xLabel}과 ${yLabel}의 산점도`}>
      <title>{`${xLabel}과 ${yLabel}의 산점도. 데이터 ${pts.length}개.`}</title>

      {ticks(minX - padX, maxX + padX).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} y1={PAD.top} x2={sx(t)} y2={H - PAD.bottom} stroke="#eef1f0" />
          <text x={sx(t)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={12} fill="#7e8b87">
            {fmt(t)}
          </text>
        </g>
      ))}
      {ticks(minY - padY, maxY + padY).map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} y1={sy(t)} x2={W - PAD.right} y2={sy(t)} stroke="#eef1f0" />
          <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" fontSize={12} fill="#7e8b87">
            {fmt(t)}
          </text>
        </g>
      ))}

      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />

      <text x={(W + PAD.left) / 2} y={H - 12} textAnchor="middle" fontSize={13} fill="#4c5a56">
        {xLabel}
      </text>
      <text
        x={-(H - PAD.bottom + PAD.top) / 2}
        y={16}
        transform="rotate(-90)"
        textAnchor="middle"
        fontSize={13}
        fill="#4c5a56"
      >
        {yLabel}
      </text>

      {pts.map((row, i) => {
        const key = String(row[colorKey] ?? '');
        const st = SPECIES_STYLE[key] ?? { color: '#7e8b87', shape: 'circle' as const };
        const isSel = selected === row;
        const isHi = highlight?.has(row) ?? false;
        return (
          <g
            key={i}
            onClick={() => onSelect(isSel ? null : row)}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={-1}
          >
            {/* 터치 판정을 시각 크기보다 넓게 (설계서 1-2) */}
            <circle cx={sx(row[xKey] as number)} cy={sy(row[yKey] as number)} r={11} fill="transparent" />
            {isHi && (
              <circle
                cx={sx(row[xKey] as number)}
                cy={sy(row[yKey] as number)}
                r={9}
                fill="none"
                stroke="#a0481c"
                strokeWidth={2.5}
              />
            )}
            <path
              d={shapePath(st.shape, sx(row[xKey] as number), sy(row[yKey] as number), isSel ? 7 : 4.2)}
              fill={st.color}
              fillOpacity={isSel ? 1 : 0.72}
              stroke={isSel ? '#14201d' : 'none'}
              strokeWidth={2}
            />
          </g>
        );
      })}

      <text x={W - PAD.right} y={PAD.top + 2} textAnchor="end" fontSize={12} fill="#4c5a56">
        데이터 {pts.length}개 · 상관계수 {Number.isNaN(r) ? '—' : r.toFixed(2)}
      </text>
    </svg>
  );
}

/* ── 종별 개수 막대그래프 ──────────────────────────────────── */

export function SpeciesBar({ rows }: { rows: Row[] }) {
  const counts = SPECIES_ORDER.map((s) => ({
    species: s,
    n: rows.filter((r) => r.species === s).length,
  }));
  const max = Math.max(...counts.map((c) => c.n), 1);
  const bw = 96;
  const gap = 44;
  const baseY = 200;

  return (
    <svg viewBox="0 0 420 240" role="img" aria-label="종별 데이터 개수">
      <title>
        {`종별 데이터 개수. ${counts.map((c) => `${speciesName(c.species)} ${c.n}개`).join(', ')}.`}
      </title>
      {counts.map((c, i) => {
        const h = (c.n / max) * 150;
        const x = 40 + i * (bw + gap);
        const st = SPECIES_STYLE[c.species];
        return (
          <g key={c.species}>
            <rect x={x} y={baseY - h} width={bw} height={h} fill={st.color} fillOpacity={0.82} rx={4} />
            <text x={x + bw / 2} y={baseY - h - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="#14201d">
              {c.n}
            </text>
            <text x={x + bw / 2} y={baseY + 19} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {speciesName(c.species)}
            </text>
            <path d={shapePath(st.shape, x + bw / 2, baseY + 32, 5)} fill={st.color} />
          </g>
        );
      })}
      <line x1={20} y1={baseY} x2={400} y2={baseY} stroke="#c3cecb" />
    </svg>
  );
}

/* ── 종별 상자그림 ─────────────────────────────────────────── */

interface BoxProps {
  rows: Row[];
  fieldKey: string;
  label: string;
  onSelectOutlier?: (row: Row) => void;
}

export function BoxPlot({ rows, fieldKey, label, onSelectOutlier }: BoxProps) {
  const groups = SPECIES_ORDER.map((s) => {
    const vals = rows
      .filter((r) => r.species === s && typeof r[fieldKey] === 'number')
      .map((r) => ({ row: r, v: r[fieldKey] as number }));
    return { species: s, vals };
  }).filter((g) => g.vals.length >= 4);

  const all = groups.flatMap((g) => g.vals.map((v) => v.v));
  if (all.length === 0) return <svg viewBox="0 0 640 300" />;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const top = 26;
  const bottom = 244;
  const sy = (v: number) => bottom - ((v - lo + span * 0.08) / (span * 1.16)) * (bottom - top);

  return (
    <svg viewBox="0 0 640 300" role="img" aria-label={`종별 ${label} 상자그림`}>
      <title>{`종별 ${label} 상자그림. 상자 밖의 점이 이상치입니다.`}</title>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const v = lo + span * p;
        return (
          <g key={p}>
            <line x1={72} y1={sy(v)} x2={620} y2={sy(v)} stroke="#eef1f0" />
            <text x={64} y={sy(v) + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      {groups.map((g, i) => {
        const vs = g.vals.map((v) => v.v);
        const b = outlierBounds(vs);
        const med = quantile(vs, 0.5);
        const inside = vs.filter((v) => v >= b.lower && v <= b.upper);
        const whiskLo = Math.min(...inside);
        const whiskHi = Math.max(...inside);
        const cx = 150 + i * 170;
        const bw = 76;
        const st = SPECIES_STYLE[g.species];
        const outs = g.vals.filter((v) => v.v < b.lower || v.v > b.upper);
        return (
          <g key={g.species}>
            <line x1={cx} y1={sy(whiskHi)} x2={cx} y2={sy(whiskLo)} stroke="#8fa8a2" strokeWidth={1.5} />
            <line x1={cx - 18} y1={sy(whiskHi)} x2={cx + 18} y2={sy(whiskHi)} stroke="#8fa8a2" strokeWidth={1.5} />
            <line x1={cx - 18} y1={sy(whiskLo)} x2={cx + 18} y2={sy(whiskLo)} stroke="#8fa8a2" strokeWidth={1.5} />
            <rect
              x={cx - bw / 2}
              y={sy(b.q3)}
              width={bw}
              height={Math.max(2, sy(b.q1) - sy(b.q3))}
              fill={st.color}
              fillOpacity={0.18}
              stroke={st.color}
              strokeWidth={1.6}
              rx={3}
            />
            <line x1={cx - bw / 2} y1={sy(med)} x2={cx + bw / 2} y2={sy(med)} stroke={st.color} strokeWidth={2.6} />
            {outs.map((o, j) => (
              <g
                key={j}
                onClick={() => onSelectOutlier?.(o.row)}
                style={{ cursor: onSelectOutlier ? 'pointer' : 'default' }}
              >
                <circle cx={cx} cy={sy(o.v)} r={12} fill="transparent" />
                <circle cx={cx} cy={sy(o.v)} r={5} fill="#a0481c" />
                <text x={cx + 12} y={sy(o.v) + 4} fontSize={11.5} fill="#a0481c" fontWeight={700}>
                  {o.v}
                </text>
              </g>
            ))}
            <text x={cx} y={268} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {speciesName(g.species)}
            </text>
            <text x={cx} y={286} textAnchor="middle" fontSize={11} fill="#7e8b87">
              이상치 {outs.length}개
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── 상관 히트맵 ───────────────────────────────────────────── */

interface HeatProps {
  rows: Row[];
  fields: { key: string; label: string }[];
  onPick: (xKey: string, yKey: string) => void;
}

export function CorrelationHeatmap({ rows, fields, onPick }: HeatProps) {
  const matrix = useMemo(() => {
    const cols = fields.map((f) =>
      rows.map((r) => r[f.key]).filter((v): v is number => typeof v === 'number'),
    );
    return fields.map((_, i) => fields.map((__, j) => correlation(cols[i], cols[j])));
  }, [rows, fields]);

  const cell = 96;
  const left = 116;
  const top = 44;
  const size = fields.length;

  const color = (v: number) => {
    if (Number.isNaN(v)) return '#eef1f0';
    // 양수는 청록, 음수는 주황. 진할수록 관계가 강하다.
    const a = Math.min(1, Math.abs(v));
    return v >= 0 ? `rgba(11,110,92,${0.12 + a * 0.72})` : `rgba(160,72,28,${0.12 + a * 0.72})`;
  };

  return (
    <svg
      viewBox={`0 0 ${left + cell * size + 16} ${top + cell * size + 26}`}
      role="img"
      aria-label="속성 사이의 상관계수 히트맵"
    >
      <title>속성 사이의 상관계수. 칸을 누르면 그 조합의 산점도로 바뀝니다.</title>
      {fields.map((f, j) => (
        <text key={f.key} x={left + cell * j + cell / 2} y={top - 12} textAnchor="middle" fontSize={12} fill="#4c5a56">
          {f.label}
        </text>
      ))}
      {fields.map((f, i) => (
        <text key={f.key} x={left - 10} y={top + cell * i + cell / 2 + 4} textAnchor="end" fontSize={12} fill="#4c5a56">
          {f.label}
        </text>
      ))}
      {matrix.map((rowv, i) =>
        rowv.map((v, j) => (
          <g
            key={`${i}-${j}`}
            onClick={() => i !== j && onPick(fields[j].key, fields[i].key)}
            style={{ cursor: i === j ? 'default' : 'pointer' }}
          >
            <rect
              x={left + cell * j}
              y={top + cell * i}
              width={cell - 4}
              height={cell - 4}
              rx={5}
              fill={color(v)}
              stroke="#ffffff"
              strokeWidth={2}
            />
            <text
              x={left + cell * j + (cell - 4) / 2}
              y={top + cell * i + (cell - 4) / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill={Math.abs(v) > 0.6 ? '#ffffff' : '#14201d'}
            >
              {Number.isNaN(v) ? '—' : v.toFixed(2)}
            </text>
          </g>
        )),
      )}
    </svg>
  );
}

/* ── 정규화 전후 분포 ──────────────────────────────────────── */

export function DistributionBars({
  rows,
  fields,
  normalized,
}: {
  rows: Row[];
  fields: { key: string; label: string }[];
  normalized: boolean;
}) {
  const stats = fields.map((f) => {
    const vs = rows.map((r) => r[f.key]).filter((v): v is number => typeof v === 'number');
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    return { ...f, min, max, q1: quantile(vs, 0.25), q3: quantile(vs, 0.75) };
  });
  const globalMax = normalized ? 1 : Math.max(...stats.map((s) => s.max));
  const left = 108;
  const right = 600;

  return (
    <svg viewBox="0 0 640 210" role="img" aria-label={normalized ? '정규화 후 값의 범위' : '정규화 전 값의 범위'}>
      <title>속성별 값의 범위 비교</title>
      {stats.map((s, i) => {
        const y = 34 + i * 42;
        const sx = (v: number) => left + (v / globalMax) * (right - left);
        return (
          <g key={s.key}>
            <text x={left - 10} y={y + 5} textAnchor="end" fontSize={12.5} fill="#4c5a56">
              {s.label}
            </text>
            <line x1={sx(s.min)} y1={y} x2={sx(s.max)} y2={y} stroke="#8fa8a2" strokeWidth={2} />
            <rect x={sx(s.q1)} y={y - 9} width={Math.max(2, sx(s.q3) - sx(s.q1))} height={18} rx={4} fill="#0b6e5c" fillOpacity={0.3} />
            <text x={sx(s.min)} y={y - 14} fontSize={11} fill="#7e8b87">
              {normalized ? s.min.toFixed(2) : Math.round(s.min)}
            </text>
            <text x={sx(s.max)} y={y - 14} textAnchor="end" fontSize={11} fill="#7e8b87">
              {normalized ? s.max.toFixed(2) : Math.round(s.max)}
            </text>
          </g>
        );
      })}
      <text x={left} y={196} fontSize={12} fill="#4c5a56">
        {normalized
          ? '모든 속성이 0 과 1 사이로 바뀌었습니다.'
          : '속성마다 값의 범위가 크게 다릅니다.'}
      </text>
    </svg>
  );
}
