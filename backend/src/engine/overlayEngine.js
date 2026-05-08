const { formatScore } = require('./scoreEngine');

/**
 * Build overlay card payload for automatic overlays after a highlight event.
 * @param {string} eventType
 * @param {object} matchState From getMatchState
 * @param {object} [extra] Optional wicket metadata
 * @returns {object}
 */
function buildOverlayData(eventType, matchState, extra = {}) {
  const inn = matchState.innings;
  const scoreShort = inn ? `${inn.runs}/${inn.wickets}` : '';
  const scoreFull = inn
    ? formatScore(inn.runs, inn.wickets, inn.overs, inn.balls)
    : '';

  if (eventType === 'WICKET') {
    return {
      type: 'WICKET',
      playerOut: extra.playerOut || '',
      runs: extra.runsOffBat ?? 0,
      balls: extra.ballsFaced ?? 0,
      dismissal: extra.dismissal || 'Wicket',
      bowler: matchState.bowling?.current?.name || '',
      score: scoreShort,
    };
  }

  if (eventType === 'SIX') {
    return {
      type: 'SIX',
      batsman: matchState.batting?.striker?.name || '',
      score: scoreFull,
    };
  }

  if (eventType === 'FOUR') {
    return {
      type: 'FOUR',
      batsman: matchState.batting?.striker?.name || '',
      score: scoreFull,
    };
  }

  if (eventType === 'OVER_END') {
    return {
      type: 'OVER_END',
      overNumber: inn?.overs ?? 0,
      runsThisOver: 0,
      wicketsThisOver: 0,
      score: scoreShort,
    };
  }

  return {
    type: eventType || 'CUSTOM',
    score: scoreFull,
  };
}

module.exports = { buildOverlayData };
