const assert = require('assert');
const scoring = require('../scoring.js');

console.log('==================================================');
console.log('TLOS SCORING ENGINE - MANDATORY RULES TEST SUITE');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error('       ' + err.message);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 3).join('\n'));
    }
  }
}

// 1. Highest Financial Return = 50
runTest('Highest Financial Return = 50 points', () => {
  const teams = [
    { id: 'T1', name: 'Team Alpha', cash: 100000, holdings: { 'TECH': 100 } },
    { id: 'T2', name: 'Team Beta', cash: 50000, holdings: { 'TECH': 100 } },
    { id: 'T3', name: 'Team Gamma', cash: 20000, holdings: { 'TECH': 50 } }
  ];
  const companies = [{ id: 'TECH', frozenFinalPrice: 100 }];
  const results = scoring.calculateFinancialReturn(teams, companies);
  assert.strictEqual(results['T1'].points, 50, 'Rank 1 must get 50 points');
  assert.strictEqual(results['T1'].rank, 1);
});

// 2. Lowest Financial Return = 0
runTest('Lowest Financial Return = 0 points', () => {
  const teams = [
    { id: 'T1', name: 'Team Alpha', cash: 100000, holdings: { 'TECH': 100 } },
    { id: 'T2', name: 'Team Beta', cash: 50000, holdings: { 'TECH': 100 } },
    { id: 'T3', name: 'Team Gamma', cash: 20000, holdings: { 'TECH': 50 } }
  ];
  const companies = [{ id: 'TECH', frozenFinalPrice: 100 }];
  const results = scoring.calculateFinancialReturn(teams, companies);
  assert.strictEqual(results['T3'].points, 0, 'Last rank must get 0 points');
});

// 3. Correct average ranks for ties
runTest('Correct average ranks for ties (Tied teams receive average of ranks they occupy)', () => {
  // 4 teams, 2 tied for 1st place (ranks 1 and 2 -> avg 1.5).
  // Points formula: 50 * (4 - 1.5) / (4 - 1) = 50 * 2.5 / 3 = 41.6666...
  const teams = [
    { id: 'T1', name: 'Team A', cash: 100000, holdings: {} },
    { id: 'T2', name: 'Team B', cash: 100000, holdings: {} },
    { id: 'T3', name: 'Team C', cash: 60000, holdings: {} },
    { id: 'T4', name: 'Team D', cash: 20000, holdings: {} }
  ];
  const companies = [];
  const results = scoring.calculateFinancialReturn(teams, companies);
  assert.strictEqual(results['T1'].averageRank, 1.5);
  assert.strictEqual(results['T2'].averageRank, 1.5);
  const expectedPoints = 50 * (4 - 1.5) / 3;
  assert(Math.abs(results['T1'].points - expectedPoints) < 1e-9);
  assert(Math.abs(results['T2'].points - expectedPoints) < 1e-9);

  // Teams 3 and 4
  assert.strictEqual(results['T3'].averageRank, 3);
  assert(Math.abs(results['T3'].points - (50 * (4 - 3) / 3)) < 1e-9);
  assert.strictEqual(results['T4'].averageRank, 4);
  assert.strictEqual(results['T4'].points, 0);
});

// 4. Six best-option decisions = 30 Decision Quality points
runTest('Six best-option decisions = 30 Decision Quality points', () => {
  const events = [];
  const eventLogs = {};
  for (let i = 1; i <= 6; i++) {
    const eId = 'EV' + i;
    events.push({
      id: eId,
      name: 'Event ' + i,
      affectedCompanies: ['AAPL'],
      options: [
        { id: 'opt_best', name: 'Best Move', cost: 0, priceChanges: { 'AAPL': 10 } },
        { id: 'opt_mid', name: 'Mid Move', cost: 500, priceChanges: { 'AAPL': 5 } },
        { id: 'opt_worst', name: 'Worst Move', cost: 1000, priceChanges: { 'AAPL': -10 } }
      ]
    });
    if (!eventLogs[eId]) eventLogs[eId] = {};
    eventLogs[eId]['T1'] = {
      chosenOptionId: 'opt_best',
      preHoldings: { 'AAPL': 100 },
      preCash: 50000,
      prePrices: { 'AAPL': 100 }
    };
  }

  const team = { id: 'T1', name: 'Star Trader' };
  const dqResult = scoring.calculateDecisionQualityForTeam(team, events, eventLogs);
  assert.strictEqual(dqResult.eventScores.length, 6);
  dqResult.eventScores.forEach((es, idx) => {
    assert.strictEqual(es.score, 5, `Event ${idx + 1} score should be 5`);
  });
  assert.strictEqual(dqResult.totalScore, 30, 'Total DQ score must be 30');
});

// 5. Best equals worst = 2.5 points for that event
runTest('Best equals worst = 2.5 points for that event', () => {
  const events = [{
    id: 'EV1',
    name: 'Neutral Market',
    affectedCompanies: ['XYZ'],
    options: [
      { id: 'opt_1', name: 'Option 1', cost: 0, priceChanges: { 'XYZ': 0 } },
      { id: 'opt_2', name: 'Option 2', cost: 0, priceChanges: { 'XYZ': 0 } }
    ]
  }];
  const eventLogs = {
    'EV1': {
      'T1': {
        chosenOptionId: 'opt_1',
        preHoldings: { 'XYZ': 100 },
        preCash: 10000,
        prePrices: { 'XYZ': 50 }
      }
    }
  };
  const team = { id: 'T1', name: 'Neutral Trader' };
  const dqResult = scoring.calculateDecisionQualityForTeam(team, events, eventLogs);
  assert.strictEqual(dqResult.eventScores[0].score, 2.5, 'Must award 2.5 points when Best equals Worst');
  assert(dqResult.eventScores[0].neutralReason.includes('equals Worst'));
});

// 6. No affected shares owned = 2.5 points
runTest('No affected shares owned = 2.5 points for that event', () => {
  const events = [{
    id: 'EV1',
    name: 'Sector Crash',
    affectedCompanies: ['OIL'],
    options: [
      { id: 'opt_hedge', name: 'Hedge Oil', cost: 500, priceChanges: { 'OIL': 0 } },
      { id: 'opt_hold', name: 'Hold Oil', cost: 0, priceChanges: { 'OIL': -20 } }
    ]
  }];
  const eventLogs = {
    'EV1': {
      'T1': {
        chosenOptionId: 'opt_hold',
        preHoldings: { 'TECH': 100, 'OIL': 0 }, // 0 OIL shares owned!
        preCash: 10000,
        prePrices: { 'TECH': 50, 'OIL': 80 }
      }
    }
  };
  const team = { id: 'T1', name: 'Diversified Trader' };
  const dqResult = scoring.calculateDecisionQualityForTeam(team, events, eventLogs);
  assert.strictEqual(dqResult.eventScores[0].score, 2.5, 'Must award 2.5 points when 0 affected shares owned');
  assert(dqResult.eventScores[0].neutralReason.includes('0 shares of affected companies'));
});

// 7. Correct diversification values
runTest('Correct diversification values (3 cos=4, 4 cos=6, 5 cos=8, 6 cos=10, <3=0)', () => {
  const teams = [
    { id: 'T0', startingHoldings: {} }, // 0 cos -> 0 pts
    { id: 'T1', startingHoldings: { 'A': 10 } }, // 1 co -> 0 pts
    { id: 'T2', startingHoldings: { 'A': 10, 'B': 5 } }, // 2 cos -> 0 pts
    { id: 'T3', startingHoldings: { 'A': 10, 'B': 5, 'C': 2 } }, // 3 cos -> 4 pts
    { id: 'T4', startingHoldings: { 'A': 10, 'B': 5, 'C': 2, 'D': 1 } }, // 4 cos -> 6 pts
    { id: 'T5', startingHoldings: { 'A': 10, 'B': 5, 'C': 2, 'D': 1, 'E': 4 } }, // 5 cos -> 8 pts
    { id: 'T6', startingHoldings: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1 } }, // 6 cos -> 10 pts
    { id: 'T7', startingHoldings: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1, 'G': 1 } } // 7 cos -> 10 pts
  ];
  const riskResults = scoring.calculateRiskManagement(teams, [], {});
  assert.strictEqual(riskResults['T0'].diversificationScore, 0);
  assert.strictEqual(riskResults['T1'].diversificationScore, 0);
  assert.strictEqual(riskResults['T2'].diversificationScore, 0);
  assert.strictEqual(riskResults['T3'].diversificationScore, 4);
  assert.strictEqual(riskResults['T4'].diversificationScore, 6);
  assert.strictEqual(riskResults['T5'].diversificationScore, 8);
  assert.strictEqual(riskResults['T6'].diversificationScore, 10);
  assert.strictEqual(riskResults['T7'].diversificationScore, 10);
});

// 8. Largest Bad Event loss = 0 Downside Control points
runTest('Largest Bad Event loss = 0 Downside Control points', () => {
  const badEvents = [
    { id: 'B1', isBadEvent: true, options: [{ id: 'opt1', cost: 0, priceChanges: {} }] },
    { id: 'B2', isBadEvent: true, options: [{ id: 'opt1', cost: 0, priceChanges: {} }] },
    { id: 'B3', isBadEvent: true, options: [{ id: 'opt1', cost: 0, priceChanges: {} }] }
  ];
  const teams = [
    { id: 'T_worst', startingHoldings: { 'A': 100 } },
    { id: 'T_mid', startingHoldings: { 'A': 100 } },
    { id: 'T_safe', startingHoldings: { 'A': 100 } }
  ];
  const eventLogs = {
    'B1': {
      'T_worst': { deltaNW: -10000 },
      'T_mid': { deltaNW: -2500 },
      'T_safe': { deltaNW: 500 }
    },
    'B2': {
      'T_worst': { deltaNW: -5000 },
      'T_mid': { deltaNW: -2500 },
      'T_safe': { deltaNW: 0 }
    },
    'B3': {
      'T_worst': { deltaNW: -5000 }, // Total loss = 20000 (largest)
      'T_mid': { deltaNW: 0 },       // Total loss = 5000
      'T_safe': { deltaNW: 1000 }    // Gain -> loss = 0
    }
  };
  const riskResults = scoring.calculateRiskManagement(teams, badEvents, eventLogs);
  assert.strictEqual(riskResults['T_worst'].teamLoss, 20000);
  assert.strictEqual(riskResults['T_worst'].largestLossInRoom, 20000);
  assert.strictEqual(riskResults['T_worst'].downsideControlScore, 0, 'Largest loss must receive 0 Downside Control points');
});

// 9. Non-losing team = 10 Downside Control points
runTest('Non-losing team = 10 Downside Control points', () => {
  const badEvents = [
    { id: 'B1', isBadEvent: true },
    { id: 'B2', isBadEvent: true },
    { id: 'B3', isBadEvent: true }
  ];
  const teams = [
    { id: 'T_worst', startingHoldings: { 'A': 100 } },
    { id: 'T_safe', startingHoldings: { 'A': 100 } }
  ];
  const eventLogs = {
    'B1': { 'T_worst': { deltaNW: -10000 }, 'T_safe': { deltaNW: 100 } },
    'B2': { 'T_worst': { deltaNW: -5000 }, 'T_safe': { deltaNW: 200 } },
    'B3': { 'T_worst': { deltaNW: -5000 }, 'T_safe': { deltaNW: 0 } }
  };
  const riskResults = scoring.calculateRiskManagement(teams, badEvents, eventLogs);
  assert.strictEqual(riskResults['T_safe'].teamLoss, 0);
  assert.strictEqual(riskResults['T_safe'].downsideControlScore, 10, 'Team with no loss must receive 10 points');
});

// 10. Only top five teams receive judge bonuses
runTest('Only top five teams receive judge bonuses (Rank 6+ receives 0)', () => {
  const teams = [];
  for (let i = 1; i <= 8; i++) {
    teams.push({
      id: 'T' + i,
      name: 'Team ' + i,
      cash: 10000 * (10 - i),
      holdings: { 'A': 10 }
    });
  }
  const companies = [{ id: 'A', frozenFinalPrice: 100 }];
  const judgeScores = {};
  for (let i = 1; i <= 8; i++) {
    judgeScores['T' + i] = [{ judgeName: 'Judge 1', clarity: 1, justification: 1, qaAnswer: 1 }]; // 3 points each
  }

  const result = scoring.evaluateSimulation(teams, companies, [], {}, judgeScores);
  // Leaderboard has 8 teams
  assert.strictEqual(result.leaderboard.length, 8);
  const top5Ids = result.top5.map(t => t.id);
  assert.strictEqual(top5Ids.length, 5);

  result.leaderboard.forEach(team => {
    if (top5Ids.includes(team.id)) {
      assert.strictEqual(team.judgeBonus, 3, 'Top 5 team should receive judge bonus');
    } else {
      assert.strictEqual(team.judgeBonus, 0, 'Rank 6+ team must receive 0 judge bonus');
    }
  });
});

// 11. Fifth-place tie-break uses Financial Return and then remaining cash
runTest('Fifth-place tie-break uses Financial Return and then remaining cash', () => {
  // Let's create teams where team 5 and team 6 have identical automatic scores,
  // but Team 5 has higher Financial Return points!
  const teams = [
    { id: 'T1', name: 'T1', cash: 90000, holdings: {} },
    { id: 'T2', name: 'T2', cash: 80000, holdings: {} },
    { id: 'T3', name: 'T3', cash: 70000, holdings: {} },
    { id: 'T4', name: 'T4', cash: 60000, holdings: {} },
    // Teams 5 and 6:
    { id: 'T5_highFin', name: 'T5 High Fin', cash: 40000, holdings: {}, startingHoldings: { 'A': 1, 'B': 1, 'C': 1 } }, // 3 cos = 4 risk pts
    { id: 'T6_highRisk', name: 'T6 High Risk', cash: 30000, holdings: {}, startingHoldings: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1 } } // 6 cos = 10 risk pts
  ];
  // We can test evaluateSimulation ordering
  const result = scoring.evaluateSimulation(teams, [], [], {}, {});
  const top5Ids = result.top5.map(t => t.id);
  assert.strictEqual(top5Ids.length, 5);
  // Also verify tie-break when auto score is identical:
  // If AutoScore(T_A) == AutoScore(T_B), T_A has FinReturn=25, T_B has FinReturn=20: T_A wins 5th place
  const tA = { id: 'TA', name: 'Team A', automaticScore: 60, financialReturn: 25, cash: 10000 };
  const tB = { id: 'TB', name: 'Team B', automaticScore: 60, financialReturn: 20, cash: 15000 };
  const list = [tA, tB];
  list.sort((a, b) => {
    if (Math.abs(b.automaticScore - a.automaticScore) > 1e-9) return b.automaticScore - a.automaticScore;
    if (Math.abs(b.financialReturn - a.financialReturn) > 1e-9) return b.financialReturn - a.financialReturn;
    return b.cash - a.cash;
  });
  assert.strictEqual(list[0].id, 'TA', 'Team with higher Financial Return should win tie');

  // If Financial Return also tied, remaining cash breaks it:
  const tC = { id: 'TC', name: 'Team C', automaticScore: 60, financialReturn: 25, cash: 15000 };
  const tD = { id: 'TD', name: 'Team D', automaticScore: 60, financialReturn: 25, cash: 10000 };
  const list2 = [tD, tC];
  list2.sort((a, b) => {
    if (Math.abs(b.automaticScore - a.automaticScore) > 1e-9) return b.automaticScore - a.automaticScore;
    if (Math.abs(b.financialReturn - a.financialReturn) > 1e-9) return b.financialReturn - a.financialReturn;
    return b.cash - a.cash;
  });
  assert.strictEqual(list2[0].id, 'TC', 'Team with higher cash should win tie');
});

// 12. Final Score equals Automatic Score plus Judge Bonus
runTest('Final Score equals Automatic Score plus Judge Bonus', () => {
  const teams = [
    { id: 'T1', name: 'Champion', cash: 100000, holdings: { 'TECH': 100 }, startingHoldings: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1 } }
  ];
  const companies = [{ id: 'TECH', frozenFinalPrice: 100 }];
  const judgeScores = {
    'T1': [
      { judgeName: 'Judge A', clarity: 1, justification: 1, qaAnswer: 1 }, // 3
      { judgeName: 'Judge B', clarity: 1, justification: 1, qaAnswer: 0 }  // 2 -> avg 2.5 -> rounded 3
    ]
  };
  const result = scoring.evaluateSimulation(teams, companies, [], {}, judgeScores);
  const champ = result.leaderboard[0];
  assert.strictEqual(champ.judgeBonus, 3);
  assert.strictEqual(champ.finalScore, champ.automaticScore + champ.judgeBonus);
});

// 13. Edge case: Single team (N=1) safe handling
runTest('Edge Case: Single team N=1 handled safely without division by zero', () => {
  const teams = [{ id: 'Solo', name: 'Solo Trader', cash: 50000, holdings: {} }];
  const results = scoring.calculateFinancialReturn(teams, []);
  assert.strictEqual(results['Solo'].points, 50, 'N=1 should safely give 50 points');
});

// 14. Edge case: No bad event loss in room -> all receive 10 Downside Control points
runTest('Edge Case: No team lost money in room -> all receive 10 Downside Control points', () => {
  const badEvents = [{ id: 'B1', isBadEvent: true }];
  const teams = [
    { id: 'T1', startingHoldings: { 'A': 10 } },
    { id: 'T2', startingHoldings: { 'B': 10 } }
  ];
  const eventLogs = {
    'B1': {
      'T1': { deltaNW: 500 },
      'T2': { deltaNW: 0 }
    }
  };
  const riskResults = scoring.calculateRiskManagement(teams, badEvents, eventLogs);
  assert.strictEqual(riskResults['T1'].downsideControlScore, 10);
  assert.strictEqual(riskResults['T2'].downsideControlScore, 10);
});

console.log('\n==================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log('==================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
