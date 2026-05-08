/**
 * @param {number} overs
 * @param {number} ballsInOver
 */
export function formatOversDisplay(overs, ballsInOver) {
  return `${overs}.${ballsInOver}`
}

/**
 * @param {number} runs
 * @param {number} balls
 */
export function strikeRate(runs, balls) {
  if (!balls) return 0
  return Math.round((runs / balls) * 1000) / 10
}

/**
 * @param {number} runs
 * @param {number} oversFloat completed overs as float
 */
export function economy(runs, oversFloat) {
  if (!oversFloat) return 0
  return Math.round((runs / oversFloat) * 100) / 100
}

/**
 * @param {number} o full overs
 * @param {number} b balls in current over
 */
export function oversFloat(o, b) {
  return Number(o) + Number(b) / 6
}

/**
 * Current run rate from innings block (runs per 6 balls).
 * @param {{ runs?: number, overs?: number, balls?: number }} inn
 */
export function currentRunRate(inn) {
  if (!inn) return 0
  const legal = Number(inn.overs) * 6 + Number(inn.balls)
  if (!legal) return 0
  return Math.round((Number(inn.runs) / legal) * 600) / 10
}

/**
 * Format score string e.g. 145/3 (22.4)
 */
export function formatScoreLine(inn) {
  if (!inn) return '0/0 (0.0)'
  return `${inn.runs}/${inn.wickets} (${formatOversDisplay(inn.overs, inn.balls)})`
}
