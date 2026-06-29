/**
 * Reliability (calibration) diagram — a dependency-free SVG.
 *
 * X = predicted probability, Y = observed frequency, both in [0, 1]. The dashed
 * diagonal is perfect calibration; each non-empty bin is a dot at
 * (predictedMean, observedRate), sized by how many samples fell in it. Points
 * below the diagonal mean over-confidence, above mean under-confidence.
 *
 * lightweight-charts is deliberately NOT used: it's a time-axis financial chart and
 * does not support an arbitrary numeric X axis.
 */

export type ReliabilityBin = {
  pMid: number;
  predictedMean: number;
  observedRate: number;
  count: number;
};

type Props = {
  bins: ReliabilityBin[];
  size?: number;
  className?: string;
};

const PAD = 28; // px for axis labels/ticks

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function ReliabilityDiagram({ bins, size = 220, className }: Props) {
  const plot = size - PAD * 2;
  // map a value in [0,1] to an x pixel; y is inverted (0 at bottom).
  const px = (v: number) => PAD + clamp01(v) * plot;
  const py = (v: number) => PAD + (1 - clamp01(v)) * plot;

  const drawn = bins.filter((b) => b.count > 0);
  const maxCount = drawn.reduce((m, b) => Math.max(m, b.count), 0) || 1;

  return (
    <svg
      role="img"
      aria-label="Reliability diagram: predicted probability versus observed frequency"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      data-testid="reliability-diagram"
    >
      {/* plot frame */}
      <rect
        x={PAD}
        y={PAD}
        width={plot}
        height={plot}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      {/* perfect-calibration diagonal */}
      <line
        x1={px(0)}
        y1={py(0)}
        x2={px(1)}
        y2={py(1)}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeDasharray="4 3"
      />
      {/* bin points */}
      {drawn.map((b) => (
        <circle
          key={b.pMid}
          data-testid="reliability-point"
          cx={px(b.predictedMean)}
          cy={py(b.observedRate)}
          r={3 + 4 * (b.count / maxCount)}
          fill="currentColor"
          fillOpacity={0.35 + 0.5 * (b.count / maxCount)}
        >
          <title>{`predicted ${(b.predictedMean * 100).toFixed(0)}% · observed ${(b.observedRate * 100).toFixed(0)}% · n=${b.count}`}</title>
        </circle>
      ))}
      {/* axis labels */}
      <text x={PAD + plot / 2} y={size - 6} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.7}>
        predicted probability
      </text>
      <text
        x={9}
        y={PAD + plot / 2}
        textAnchor="middle"
        fontSize="9"
        fill="currentColor"
        fillOpacity={0.7}
        transform={`rotate(-90 9 ${PAD + plot / 2})`}
      >
        observed frequency
      </text>
    </svg>
  );
}
