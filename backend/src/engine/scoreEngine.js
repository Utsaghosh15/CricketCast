const { pool } = require('../db/pool');
const matchDB = require('../db/matchDB');
const playerDB = require('../db/playerDB');
const ballDB = require('../db/ballDB');

/**
 * Format overs display like 22.4 from completed overs and balls in current over.
 * @param {number} overs
 * @param {number} ballsInOver
 * @returns {string}
 */
function formatOversDisplay(overs, ballsInOver) {
  return `${overs}.${ballsInOver}`;
}

/**
 * Build score string e.g. "145/3 (22.4)".
 * @param {number} runs
 * @param {number} wickets
 * @param {number} overs
 * @param {number} ballsInOver
 */
function formatScore(runs, wickets, overs, ballsInOver) {
  return `${runs}/${wickets} (${formatOversDisplay(overs, ballsInOver)})`;
}

/**
 * Strike rate.
 * @param {number} runs
 * @param {number} balls
 */
function strikeRate(runs, balls) {
  if (!balls) return 0;
  return Math.round((runs / balls) * 1000) / 10;
}

/**
 * Economy.
 * @param {number} runs
 * @param {number} oversFloat
 */
function economy(runs, oversFloat) {
  if (!oversFloat) return 0;
  return Math.round((runs / oversFloat) * 100) / 100;
}

/**
 * Overs as float from bowling card overs/balls.
 * @param {number} o
 * @param {number} b
 */
function oversFloat(o, b) {
  return Number(o) + Number(b) / 6;
}

/**
 * Load full match state for API and WebSocket clients.
 * @param {string} matchId
 * @param {import('pg').Pool} [db]
 * @returns {Promise<object>}
 */
async function getMatchState(matchId, db = pool) {
  const mRes = await db.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
  const match = mRes.rows[0];
  if (!match) return null;

  const teamsRows = await playerDB.getTeamsByMatchId(matchId, db);
  const team1Row = teamsRows.find((t) => t.team_number === 1);
  const team2Row = teamsRows.find((t) => t.team_number === 2);

  const players = await playerDB.getPlayersWithTeams(matchId, db);
  const umpires = await playerDB.getUmpiresByMatchId(matchId, db);

  const innRes = await db.query(
    `SELECT * FROM innings WHERE match_id = $1 AND innings_number = $2`,
    [matchId, match.current_innings]
  );
  const inn = innRes.rows[0];

  let inningsBlock = {
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
    runRate: 0,
  };

  let batting = {
    striker: null,
    nonStriker: null,
  };
  let bowling = { current: null, thisOver: [] };
  let target = null;
  let requiredRunRate = null;
  let requiredRuns = null;
  let requiredBalls = null;

  if (inn) {
    const legalBalls = Number(inn.overs) * 6 + Number(inn.balls);
    const oversDisplay = formatOversDisplay(Number(inn.overs), Number(inn.balls));
    const rr =
      legalBalls > 0 ? Math.round((Number(inn.runs) / legalBalls) * 600) / 10 : 0;

    inningsBlock = {
      runs: Number(inn.runs),
      wickets: Number(inn.wickets),
      overs: Number(inn.overs),
      balls: Number(inn.balls),
      oversDisplay,
      extras: {
        wide: Number(inn.extras_wide),
        noBall: Number(inn.extras_noball),
        bye: Number(inn.extras_bye),
        legBye: Number(inn.extras_legbye),
      },
      runRate: rr,
      pendingOverEnd: !!inn.pending_over_end,
    };

    const moRes = await db.query(
      `SELECT MAX(over_number)::int AS m FROM balls WHERE innings_id = $1`,
      [inn.id]
    );
    const currentOverNum = moRes.rows[0].m || 1;
    const overBalls = await ballDB.listBallsInOver(db, inn.id, currentOverNum);
    bowling.thisOver = overBalls.map((b) => ({
      type: b.type,
      totalRuns: Number(b.total_runs),
      runsOffBat: Number(b.runs_off_bat),
    }));

    const strikerRow = inn.striker_id
      ? await playerDB.getPlayerById(inn.striker_id, db)
      : null;
    const nonRow = inn.non_striker_id ? await playerDB.getPlayerById(inn.non_striker_id, db) : null;
    const bowlerRow = inn.current_bowler_id
      ? await playerDB.getPlayerById(inn.current_bowler_id, db)
      : null;

    const sCard = strikerRow
      ? await ballDB.getBattingCard(db, inn.id, strikerRow.id)
      : null;
    const nCard = nonRow ? await ballDB.getBattingCard(db, inn.id, nonRow.id) : null;
    const bCard = bowlerRow
      ? await ballDB.getBowlingCard(db, inn.id, bowlerRow.id)
      : null;

    batting.striker = strikerRow
      ? {
          id: strikerRow.id,
          name: strikerRow.name,
          runs: sCard ? Number(sCard.runs) : 0,
          balls: sCard ? Number(sCard.balls) : 0,
          fours: sCard ? Number(sCard.fours) : 0,
          sixes: sCard ? Number(sCard.sixes) : 0,
          strikeRate: sCard ? strikeRate(Number(sCard.runs), Number(sCard.balls)) : 0,
        }
      : null;

    batting.nonStriker = nonRow
      ? {
          id: nonRow.id,
          name: nonRow.name,
          runs: nCard ? Number(nCard.runs) : 0,
          balls: nCard ? Number(nCard.balls) : 0,
          fours: nCard ? Number(nCard.fours) : 0,
          sixes: nCard ? Number(nCard.sixes) : 0,
        }
      : null;

    bowling.current = bowlerRow
      ? {
          id: bowlerRow.id,
          name: bowlerRow.name,
          overs: bCard ? Number(bCard.overs) : 0,
          balls: bCard ? Number(bCard.balls) : 0,
          runs: bCard ? Number(bCard.runs) : 0,
          wickets: bCard ? Number(bCard.wickets) : 0,
          economy: bCard
            ? economy(Number(bCard.runs), oversFloat(Number(bCard.overs), Number(bCard.balls)))
            : 0,
        }
      : null;

    if (Number(match.current_innings) === 2 && match.target != null) {
      target = Number(match.target);
      requiredRuns = Math.max(0, target - Number(inn.runs));
      const totalMatchOvers = match.total_overs ? Number(match.total_overs) : null;
      if (totalMatchOvers != null) {
        const maxBalls = totalMatchOvers * 6;
        requiredBalls = Math.max(0, maxBalls - legalBalls);
        requiredRunRate =
          requiredBalls > 0
            ? Math.round((requiredRuns / requiredBalls) * 600) / 10
            : null;
      }
    }
  }

  return {
    match: {
      id: match.id,
      title: match.title,
      format: match.format,
      totalOvers: match.total_overs,
      venue: match.venue,
      matchDate: match.match_date,
      status: match.status,
      currentInnings: match.current_innings,
      target: match.target,
      tossWinner: match.toss_winner,
      tossElected: match.toss_elected,
      streamUrl: match.stream_url,
      streamKey: match.stream_key,
      resultText: match.result_text,
      manOfMatchId: match.man_of_match_id,
    },
    teams: {
      team1: team1Row
        ? {
            id: team1Row.id,
            name: team1Row.name,
            players: players.filter((p) => p.team_number === 1),
          }
        : null,
      team2: team2Row
        ? {
            id: team2Row.id,
            name: team2Row.name,
            players: players.filter((p) => p.team_number === 2),
          }
        : null,
    },
    umpires,
    innings: inningsBlock,
    batting,
    bowling,
    target,
    requiredRunRate,
    requiredRuns,
    requiredBalls,
  };
}

module.exports = {
  getMatchState,
  formatScore,
  formatOversDisplay,
  strikeRate,
  economy,
};
