const assert = require('assert');
const scoring = require('../scoring.js');
const defaultData = require('../data.js');

console.log('==================================================');
console.log('TLOS FULL SIMULATION END-TO-END INTEGRATION TEST');
console.log('==================================================\n');

// 1. Verify Demo Data Integrity
console.log('Checking demo data integrity...');
assert.strictEqual(defaultData.DEFAULT_COMPANIES.length, 6, 'Must have 6 companies');
assert.strictEqual(defaultData.DEFAULT_EVENTS.length, 6, 'Must have 6 events');
const badEvents = defaultData.DEFAULT_EVENTS.filter(e => e.isBadEvent);
assert.strictEqual(badEvents.length, 3, 'Must have exactly 3 Bad Events');
assert.strictEqual(defaultData.DEMO_TEAMS.length, 10, 'Must have 10 demo teams');
console.log('✓ Demo data schema verified.\n');

// 2. Full Simulation Pipeline Execution
console.log('Executing full evaluation pipeline on demo tournament...');
const result = scoring.evaluateSimulation(
  defaultData.DEMO_TEAMS,
  defaultData.DEFAULT_COMPANIES,
  defaultData.DEFAULT_EVENTS,
  defaultData.DEMO_EVENT_LOGS,
  defaultData.DEMO_JUDGE_SCORES
);

assert(result.leaderboard && result.leaderboard.length === 10, 'Leaderboard must contain all 10 teams');
assert(result.top5 && result.top5.length === 5, 'Must select exactly 5 finalists');

// Check that top 5 are sorted descending by automatic score
for (let i = 0; i < result.top5.length - 1; i++) {
  assert(
    result.top5[i].automaticScore >= result.top5[i + 1].automaticScore,
    `Top 5 team ${i} score (${result.top5[i].automaticScore}) must be >= team ${i+1} score (${result.top5[i+1].automaticScore})`
  );
}
console.log('✓ Top 5 finalists correctly ranked by Automatic Score.\n');

// Verify Judge Bonus Constraints
console.log('Checking judge bonus rules...');
result.leaderboard.forEach(team => {
  if (team.isTop5) {
    assert(team.judgeBonus >= 0 && team.judgeBonus <= 3, 'Top 5 judge bonus must be between 0 and 3');
    assert(team.finalScore <= 103, 'Maximum final score cannot exceed 103');
    assert.strictEqual(team.finalScore, team.automaticScore + team.judgeBonus, 'Final score must equal auto + judge');
  } else {
    assert.strictEqual(team.judgeBonus, 0, 'Teams outside top 5 must strictly receive 0 judge bonus');
    assert.strictEqual(team.finalScore, team.automaticScore, 'Non-top-5 final score must equal automatic score');
  }
});
console.log('✓ Judge bonuses strictly awarded to Top 5 only and capped at 3.\n');

// Verify Metric Bounds for All Teams
console.log('Checking metric score bounds across all teams...');
result.leaderboard.forEach(team => {
  assert(team.financialReturn >= 0 && team.financialReturn <= 50, `Financial Return out of bounds for ${team.name}: ${team.financialReturn}`);
  assert(team.decisionQuality >= 0 && team.decisionQuality <= 30, `Decision Quality out of bounds for ${team.name}: ${team.decisionQuality}`);
  assert(team.riskManagement >= 0 && team.riskManagement <= 20, `Risk Management out of bounds for ${team.name}: ${team.riskManagement}`);
  assert(team.automaticScore >= 0 && team.automaticScore <= 100, `Automatic Score out of bounds for ${team.name}: ${team.automaticScore}`);
  assert(team.finalScore >= 0 && team.finalScore <= 103, `Final Score out of bounds for ${team.name}: ${team.finalScore}`);
});
console.log('✓ All metric boundaries strictly respected for every team.\n');

// Print Tournament Standings
console.log('Final Standings Table:');
console.log('------------------------------------------------------------------------------------------------------');
console.log('Rank | Team Name              | Net Worth    | Fin (50) | DQ (30)  | Risk (20) | Auto (100) | Judge | Final');
console.log('------------------------------------------------------------------------------------------------------');
result.leaderboard.forEach((t, idx) => {
  const r = (t.finalRank || (idx + 1)).toString().padStart(4);
  const name = t.name.padEnd(22);
  const nw = ('$' + t.finalNetWorth.toLocaleString()).padStart(12);
  const fin = t.financialReturn.toFixed(2).padStart(8);
  const dq = t.decisionQuality.toFixed(2).padStart(8);
  const risk = t.riskManagement.toFixed(2).padStart(9);
  const auto = t.automaticScore.toFixed(2).padStart(10);
  const j = ('+' + t.judgeBonus).padStart(5);
  const final = t.finalScore.toFixed(2).padStart(7);
  console.log(`${r} | ${name} | ${nw} | ${fin} | ${dq} | ${risk} | ${auto} | ${j} | ${final}`);
});
console.log('------------------------------------------------------------------------------------------------------\n');

console.log('==================================================');
console.log('INTEGRATION TEST: ALL CHECKS PASSED');
console.log('==================================================');
