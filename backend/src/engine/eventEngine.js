const { formatScore } = require('./scoreEngine');

/**
 * Build payload common fields from match state.
 * @param {object} newState
 * @param {object} ballData
 */
function basePayload(newState, ballData, prevState = null) {
  const inn = newState.innings;
  const score = inn
    ? formatScore(inn.runs, inn.wickets, inn.overs, inn.balls)
    : '';
  const bat =
    ballData.type === 'WICKET' && prevState
      ? prevState.batting?.striker?.name || ''
      : newState.batting?.striker?.name || '';
  const bow = newState.bowling?.current?.name || '';
  return {
    batsman: bat,
    bowler: bow,
    runs: Number(ballData.totalRuns ?? ballData.runsOffBat ?? 0),
    score,
  };
}

/**
 * Classify highlight event from latest delivery and state transition.
 * @param {object} ballData Normalized delivery (type, runsOffBat, dismissalType, etc.)
 * @param {object|null} prevState Result of getMatchState before ball
 * @param {object} newState Result of getMatchState after ball
 * @returns {{ events: Array<{ type: string, matchId: string, realWorldTime: number, payload: object }> }}
 */
function detectEvent(ballData, prevState, newState) {
  const matchId = newState.match.id;
  const now = Date.now();
  const type = ballData.type;
  const rob = Number(ballData.runsOffBat) || 0;
  const pay = basePayload(newState, ballData, prevState);

  /** @type {Array<{ type: string, matchId: string, realWorldTime: number, payload: object }>} */
  const events = [];

  let highlightType = 'RUNS';
  if (type === 'RUN' && rob === 6) highlightType = 'SIX';
  else if (type === 'RUN' && rob === 4) highlightType = 'FOUR';
  else if (type === 'RUN' && rob === 0) highlightType = 'DOT';
  else if (type === 'WICKET') highlightType = 'WICKET';
  else if (type === 'WIDE') highlightType = 'WIDE';
  else if (type === 'NO_BALL') highlightType = 'NO_BALL';
  else if (type === 'BYE') highlightType = 'BYE';
  else if (type === 'LEG_BYE') highlightType = 'LEG_BYE';

  if (highlightType === 'WICKET') {
    const allPlayers = [
      ...(newState.teams?.team1?.players || []),
      ...(newState.teams?.team2?.players || []),
    ];
    const dismissedName =
      allPlayers.find((p) => String(p.id) === String(ballData.dismissedPlayerId))?.name || '';
    events.push({
      type: 'WICKET',
      matchId,
      realWorldTime: now,
      payload: {
        ...pay,
        batsman: dismissedName || pay.batsman,
        dismissalType: ballData.dismissalType,
        dismissal: ballData.dismissalType,
        playerOut: dismissedName,
      },
    });
  } else if (highlightType === 'SIX' || highlightType === 'FOUR' || highlightType === 'DOT') {
    events.push({
      type: highlightType,
      matchId,
      realWorldTime: now,
      payload: { ...pay },
    });
  } else if (
    highlightType === 'WIDE' ||
    highlightType === 'NO_BALL' ||
    highlightType === 'BYE' ||
    highlightType === 'LEG_BYE'
  ) {
    events.push({
      type: highlightType,
      matchId,
      realWorldTime: now,
      payload: { ...pay },
    });
  } else {
    events.push({
      type: 'RUNS',
      matchId,
      realWorldTime: now,
      payload: { ...pay },
    });
  }

  events.push({
    type: 'SCORE_UPDATE',
    matchId,
    realWorldTime: now,
    payload: { state: newState },
  });

  return { events };
}

module.exports = { detectEvent, basePayload };
