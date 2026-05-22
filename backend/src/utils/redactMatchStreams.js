/**
 * Strip MediaMTX / playback secrets from match state for unauthenticated viewers.
 * @param {object|null|undefined} state
 * @returns {object|null|undefined}
 */
function redactMatchState(state) {
  if (!state || typeof state !== 'object') return state;
  if (!state.match || typeof state.match !== 'object') return state;
  return {
    ...state,
    match: {
      ...state.match,
      streamUrl: null,
      streamKey: null,
    },
  };
}

/**
 * Redis fan-out envelope: { channel, payload } where payload may be SCORE_UPDATE with full state.
 * @param {object} envelope
 * @returns {object}
 */
function redactFanoutEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return envelope;
  const out = JSON.parse(JSON.stringify(envelope));
  const ev = out.payload;
  if (ev && ev.type === 'SCORE_UPDATE' && ev.payload && ev.payload.state) {
    ev.payload.state = redactMatchState(ev.payload.state);
  }
  return out;
}

module.exports = { redactMatchState, redactFanoutEnvelope };
