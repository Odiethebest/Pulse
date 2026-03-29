export const METRIC_META = {
  drama: {
    label: 'Drama',
    tone: 'red',
    guide: 'How emotionally charged and escalation-prone this debate is.',
    levels: [
      { max: 34, tag: 'Low pressure', meaning: 'Conversation is relatively calm and unlikely to spill over right away.' },
      { max: 64, tag: 'Active tension', meaning: 'Conflict is established and still spreading.' },
      { max: 100, tag: 'Peak conflict', meaning: 'High-intensity clashes are driving repeat amplification.' },
    ],
  },
  polarization: {
    label: 'Polarization',
    tone: 'amber',
    guide: 'How far apart the supporting and opposing camps are.',
    levels: [
      { max: 34, tag: 'Shared center', meaning: 'Most viewpoints still overlap around a shared center.' },
      { max: 64, tag: 'Camp divide', meaning: 'Support and oppose camps are separating into clearer sides.' },
      { max: 100, tag: 'Hard split', meaning: 'Camps are strongly opposed and common ground is thin.' },
    ],
  },
  heat: {
    label: 'Heat',
    tone: 'blue',
    guide: 'How fast the topic is spreading and how dense the discussion is.',
    levels: [
      { max: 34, tag: 'Slow pace', meaning: 'New discussion is arriving slowly; momentum is limited.' },
      { max: 64, tag: 'Sustained', meaning: 'Discussion is moving steadily with periodic spikes.' },
      { max: 100, tag: 'Surging', meaning: 'Conversation is accelerating quickly across multiple communities.' },
    ],
  },
  flipRisk: {
    label: 'Flip Risk',
    tone: 'green',
    guide: 'How likely new information is to overturn the current conclusion.',
    levels: [
      { max: 34, tag: 'Stable line', meaning: 'The current narrative is relatively stable in the near term.' },
      { max: 64, tag: 'Sensitive', meaning: 'A single strong update could materially change the call.' },
      { max: 100, tag: 'Volatile', meaning: 'The narrative is fragile and can flip quickly.' },
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
    summary: 'How much usable discussion signal we actually captured.',
  },
  {
    key: 'diversity',
    label: 'Diversity',
    drivers: ['polarization', 'heat'],
    summary: 'Whether perspectives come from multiple circles, not one echo chamber.',
  },
  {
    key: 'agreement',
    label: 'Agreement',
    drivers: ['polarization', 'flipRisk'],
    summary: 'Whether independent sources point in a similar direction.',
  },
  {
    key: 'evidenceSupport',
    label: 'Evidence Support',
    drivers: ['drama', 'flipRisk'],
    summary: 'Whether key claims are backed by traceable sources.',
  },
  {
    key: 'stability',
    label: 'Stability',
    drivers: ['flipRisk', 'heat'],
    summary: 'How likely the conclusion is to hold after the next information wave.',
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
    return { tag: 'Pending report', meaning: 'Will update when this analysis finishes.' }
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
    return { label: 'Pending report', note: 'Confidence explanation will appear after analysis completes.' }
  }
  if (value < 40) {
    return { label: 'Low confidence', note: 'Treat this as directional only: evidence or sample depth is still weak, so verify with source citations.' }
  }
  if (value < 70) {
    return { label: 'Medium confidence', note: 'Useful, but still revision-prone if new facts land; check Evidence and Stability first.' }
  }
  return { label: 'High confidence', note: 'Relatively reliable for short-term judgment: coverage and evidence quality are both solid.' }
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

export function buildConfidenceDimensionReason(key, score, metrics) {
  const value = clampScore(score)
  if (value === null) {
    return 'Explanation will appear after analysis completes.'
  }

  const heat = clampScore(metrics?.heat)
  const drama = clampScore(metrics?.drama)
  const polarization = clampScore(metrics?.polarization)
  const flipRisk = clampScore(metrics?.flipRisk)

  if (key === 'coverage') {
    if (value >= 75) {
      return `High coverage: current Heat (${heat ?? '--'}) and Drama (${drama ?? '--'}) provide enough signal volume.`
    }
    if (value >= 45) {
      return `Moderate coverage: baseline signal exists, but Heat (${heat ?? '--'}) or Drama (${drama ?? '--'}) is not strong enough yet.`
    }
    return `Low coverage: Heat (${heat ?? '--'}) and Drama (${drama ?? '--'}) are both weak, so sample depth is limited.`
  }

  if (key === 'diversity') {
    if (value >= 75) {
      return 'High diversity: multiple camps and communities are represented, reducing single-group bias.'
    }
    if (value >= 45) {
      return 'Moderate diversity: there are mixed viewpoints, but some communities are still underrepresented.'
    }
    return 'Low diversity: discussion is concentrated in a narrow set of viewpoints, so perspective coverage is thin.'
  }

  if (key === 'agreement') {
    if (value >= 75) {
      return 'High agreement: cross-source signals mostly align with limited interpretive conflict.'
    }
    if (value >= 45) {
      return 'Moderate agreement: some sources reinforce each other, but meaningful disagreement remains.'
    }
    return `Low agreement: polarization (${polarization ?? '--'}) and/or flip risk (${flipRisk ?? '--'}) is suppressing consensus.`
  }

  if (key === 'evidenceSupport') {
    if (value >= 75) {
      return 'Strong evidence support: key conclusions are mostly traceable to explicit sources.'
    }
    if (value >= 45) {
      return 'Moderate evidence support: core claims are partly traceable, but some judgments still lack direct backing.'
    }
    return `Weak evidence support: narrative volatility (Flip Risk ${flipRisk ?? '--'}) suggests the evidence chain is still thin.`
  }

  if (key === 'stability') {
    if (value >= 75) {
      return 'High stability: even with incremental updates, the current call is unlikely to swing sharply.'
    }
    if (value >= 45) {
      return 'Moderate stability: usable now, but a strong catalyst could still force a revision.'
    }
    return `Low stability: elevated flip risk (${flipRisk ?? '--'}) means the call is sensitive to new information.`
  }

  return 'This dimension explains how the overall confidence score is composed.'
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
        ? 'Discussion is accelerating quickly and likely to keep expanding in the near term.'
        : heat >= 35
          ? 'Discussion is still spreading, with room for new conflict points to emerge.'
          : 'Discussion volume is limited and momentum is currently weak.'
    )
  }
  if (polarization !== null) {
    lines.push(
      polarization >= 65
        ? 'Camp split is pronounced, so follow-on discourse will likely stay confrontational.'
        : polarization >= 35
          ? 'Opposing camps are visible, but some overlap remains.'
          : 'Most viewpoints remain near the center, so conflict is more manageable.'
    )
  }
  if (flipRisk !== null && confidence !== null) {
    lines.push(
      flipRisk >= 65
        ? `Flip risk is elevated and continues to weigh on confidence (${confidence}).`
        : `Flip risk is contained and currently supports confidence (${confidence}).`
    )
  } else if (confidence !== null) {
    lines.push(`Current confidence is ${confidence}; read it together with Evidence and Stability.`)
  }
  return lines.slice(0, 3)
}
