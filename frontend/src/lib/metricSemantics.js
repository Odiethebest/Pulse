export const METRIC_META = {
  drama: {
    label: 'Drama',
    tone: 'red',
    guide: 'How intense and emotional the clash feels.',
    levels: [
      { max: 34, tag: 'Low pressure', meaning: 'The story is calm and unlikely to dominate feeds.' },
      { max: 64, tag: 'Active tension', meaning: 'Argument is visible and still expanding.' },
      { max: 100, tag: 'Peak conflict', meaning: 'Fight dynamics are strong and highly shareable.' },
    ],
  },
  polarization: {
    label: 'Polarization',
    tone: 'amber',
    guide: 'How split the camps are around the topic.',
    levels: [
      { max: 34, tag: 'Shared center', meaning: 'Most users cluster around similar views.' },
      { max: 64, tag: 'Camp divide', meaning: 'Clear support and oppose blocs are forming.' },
      { max: 100, tag: 'Hard split', meaning: 'Consensus is weak and rebuttal cycles are strong.' },
    ],
  },
  heat: {
    label: 'Heat',
    tone: 'blue',
    guide: 'How fast this topic is being discussed.',
    levels: [
      { max: 34, tag: 'Slow pace', meaning: 'Low posting speed and weaker momentum.' },
      { max: 64, tag: 'Sustained', meaning: 'Steady discussion with recurring spikes.' },
      { max: 100, tag: 'Surging', meaning: 'Conversation is moving quickly across threads.' },
    ],
  },
  flipRisk: {
    label: 'Flip Risk',
    tone: 'green',
    guide: 'How easily the narrative can reverse.',
    levels: [
      { max: 34, tag: 'Stable line', meaning: 'Current storyline is hard to dislodge.' },
      { max: 64, tag: 'Sensitive', meaning: 'One strong trigger can shift neutral users.' },
      { max: 100, tag: 'Volatile', meaning: 'A new catalyst can rapidly rewrite sentiment.' },
    ],
  },
}

export const CONFIDENCE_BREAKDOWN_META = [
  { key: 'coverage', label: 'Coverage' },
  { key: 'diversity', label: 'Diversity' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'evidenceSupport', label: 'Evidence' },
  { key: 'stability', label: 'Stability' },
]

export const CONFIDENCE_MAP = [
  {
    key: 'coverage',
    label: 'Coverage',
    drivers: ['heat', 'drama'],
    summary: 'Heat and drama expand the amount of observable signal.',
  },
  {
    key: 'diversity',
    label: 'Diversity',
    drivers: ['polarization', 'heat'],
    summary: 'Polarization reveals camp variety, heat adds sample breadth.',
  },
  {
    key: 'agreement',
    label: 'Agreement',
    drivers: ['polarization', 'flipRisk'],
    summary: 'Lower polarization and lower flip risk usually improve consensus confidence.',
  },
  {
    key: 'evidenceSupport',
    label: 'Evidence Support',
    drivers: ['drama', 'flipRisk'],
    summary: 'Strong evidence benefits from rich signal and controlled narrative volatility.',
  },
  {
    key: 'stability',
    label: 'Stability',
    drivers: ['flipRisk', 'heat'],
    summary: 'Lower flip risk is the main driver of stable conclusions.',
  },
]

export function clampScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round(Number(value))))
}

export function metricLabel(metricKey) {
  return METRIC_META[metricKey]?.label ?? metricKey
}

export function getMetricLevel(metricKey, score) {
  const meta = METRIC_META[metricKey]
  const value = clampScore(score)
  if (!meta || value === null) {
    return { tag: 'Pending report', meaning: 'Waiting for completed analysis output.' }
  }
  return meta.levels.find((lvl) => value <= lvl.max) ?? meta.levels[meta.levels.length - 1]
}

export function getMetricNarrative(metricKey, score) {
  const level = getMetricLevel(metricKey, score)
  return level.meaning
}

export function getConfidenceBand(score) {
  const value = clampScore(score)
  if (value === null) {
    return { label: 'Pending report', note: 'Run analysis to compute confidence.' }
  }
  if (value < 40) {
    return { label: 'Low confidence', note: 'Treat findings as directional only and verify with more evidence.' }
  }
  if (value < 70) {
    return { label: 'Medium confidence', note: 'The narrative is useful, but some factors can still shift quickly.' }
  }
  return { label: 'High confidence', note: 'Signal quality is strong enough for reliable short term interpretation.' }
}

export function getConfidenceState(score) {
  const value = clampScore(score)
  if (value === null) return { label: 'Pending', color: 'text-[#9ca3af]' }
  if (value < 40) return { label: 'Low', color: 'text-[#ef4444]' }
  if (value < 70) return { label: 'Medium', color: 'text-[#eab308]' }
  return { label: 'High', color: 'text-[#22c55e]' }
}

export function normalizeMetrics(metrics) {
  return {
    drama: clampScore(metrics?.drama),
    polarization: clampScore(metrics?.polarization),
    heat: clampScore(metrics?.heat),
    flipRisk: clampScore(metrics?.flipRisk),
  }
}

export function normalizeConfidenceBreakdown(breakdown) {
  const source = breakdown ?? {}
  return CONFIDENCE_BREAKDOWN_META.map((item) => ({
    ...item,
    value: clampScore(source[item.key]),
  }))
}

export function buildSnapshotReadout(metrics, confidenceScore) {
  const normalized = normalizeMetrics(metrics)
  const polarization = normalized.polarization
  const heat = normalized.heat
  const flipRisk = normalized.flipRisk
  const confidence = clampScore(confidenceScore)

  const lines = []
  if (heat !== null) {
    lines.push(
      heat >= 65
        ? 'Conversation velocity is high, so this topic can keep climbing quickly.'
        : heat >= 35
          ? 'Discussion is active and still accumulating new angles.'
          : 'Discussion volume is limited, so momentum is currently weak.'
    )
  }
  if (polarization !== null) {
    lines.push(
      polarization >= 65
        ? 'Audience camps are deeply split, so direct confrontation narratives will dominate.'
        : polarization >= 35
          ? 'Competing camps are visible, but cross camp overlap still exists.'
          : 'Most voices remain close to a shared center, with less hostile framing.'
    )
  }
  if (flipRisk !== null && confidence !== null) {
    lines.push(
      flipRisk >= 65
        ? `Flip risk is high, which puts pressure on the current confidence score of ${confidence}.`
        : `Flip risk is contained, which helps protect the current confidence score of ${confidence}.`
    )
  } else if (confidence !== null) {
    lines.push(`Current confidence is ${confidence}. Check evidence support and stability for reliability context.`)
  }
  return lines.slice(0, 3)
}
