/**
 * TLOS — The Market Simulation Evaluation Engine
 * 
 * Official Scoring Engine Rules:
 * - Metric 1: Financial Return (50 points)
 * - Metric 2: Decision Quality (30 points)
 * - Metric 3: Risk Management (20 points = 10 Diversification + 10 Downside Control)
 * - Automatic Score: 100 points
 * - Judge Bonus: 0–3 points (awarded only to top 5)
 * - Final Score: 103 points maximum
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.TLOSScoring = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Calculate final net worth of a team.
   * Final Net Worth = Cash + sum of (share quantity * frozen final share price)
   * 
   * @param {Object} team - { cash, holdings: { [companyId]: quantity } }
   * @param {Array} companies - Array of { id, frozenFinalPrice, currentPrice, ... }
   * @returns {number} Final Net Worth
   */
  function calculateFinalNetWorth(team, companies) {
    var cash = typeof team.cash === 'number' ? team.cash : 0;
    var holdings = team.holdings || {};
    var stockValue = 0;

    for (var i = 0; i < companies.length; i++) {
      var c = companies[i];
      var qty = holdings[c.id] || 0;
      // Frozen final price takes precedence; if not set, fallback to currentPrice then startingPrice
      var price = typeof c.frozenFinalPrice === 'number' ? c.frozenFinalPrice :
                  (typeof c.currentPrice === 'number' ? c.currentPrice : (c.startingPrice || 0));
      stockValue += qty * price;
    }

    return cash + stockValue;
  }

  /**
   * Metric 1: Financial Return — 50 points
   * Formula: Financial Return = 50 * (Number of Teams - Rank) / (Number of Teams - 1)
   * Rank 1 gets 50 points. Last place gets 0 points.
   * Tied teams receive the average of the ranks they occupy.
   * If Number of Teams == 1, safe edge case returns 50.
   * 
   * @param {Array} teams - Array of team objects
   * @param {Array} companies - Array of company objects
   * @returns {Map|Object} Mapping from team.id to { finalNetWorth, rank, averageRank, points, formulaInputs }
   */
  function calculateFinancialReturn(teams, companies) {
    var results = {};
    if (!teams || teams.length === 0) return results;

    var n = teams.length;

    // Edge case: 1 team
    if (n === 1) {
      var singleTeam = teams[0];
      var nw = calculateFinalNetWorth(singleTeam, companies);
      results[singleTeam.id] = {
        finalNetWorth: nw,
        rank: 1,
        averageRank: 1,
        points: 50,
        formulaInputs: { N: 1, rank: 1, tiedRanks: [1] }
      };
      return results;
    }

    // Calculate net worth for each team
    var teamEntries = teams.map(function (team) {
      return {
        id: team.id,
        team: team,
        netWorth: calculateFinalNetWorth(team, companies)
      };
    });

    // Sort descending by net worth
    teamEntries.sort(function (a, b) {
      return b.netWorth - a.netWorth;
    });

    // Determine ranks and average ranks for ties
    // A group of tied teams occupying positions i through j (1-indexed) gets avg rank = (i + ... + j) / count
    var i = 0;
    while (i < n) {
      var j = i;
      while (j < n - 1 && Math.abs(teamEntries[j + 1].netWorth - teamEntries[i].netWorth) < 1e-9) {
        j++;
      }

      var rankCount = (j - i + 1);
      var sumRanks = 0;
      var tiedRanks = [];
      for (var r = i + 1; r <= j + 1; r++) {
        sumRanks += r;
        tiedRanks.push(r);
      }
      var avgRank = sumRanks / rankCount;

      for (var k = i; k <= j; k++) {
        var teamId = teamEntries[k].id;
        var points = 50 * (n - avgRank) / (n - 1);
        results[teamId] = {
          finalNetWorth: teamEntries[k].netWorth,
          rank: i + 1, // display rank
          averageRank: avgRank,
          points: points,
          formulaInputs: {
            N: n,
            averageRank: avgRank,
            tiedRanks: tiedRanks
          }
        };
      }

      i = j + 1;
    }

    return results;
  }

  /**
   * Helper: Calculate net-worth change caused by a specific option for a team.
   * Evaluated using the team's own holdings immediately before that event.
   * Net worth change = Post NW - Pre NW
   * Including transaction cost paid and price changes for affected companies.
   * 
   * Option schema:
   * - cost: number (deducted from cash)
   * - cashAdjustment: number (optional, e.g. direct payout or dividend)
   * - priceChanges: { [companyId]: deltaPrice }
   * - sharesDelta: { [companyId]: deltaShares } (optional, e.g. emergency buy/sell)
   * 
   * @param {Object} option
   * @param {Object} preHoldings - { [companyId]: quantity }
   * @param {number} preCash
   * @param {Object} prePrices - { [companyId]: price }
   * @returns {number} Net worth change
   */
  function calculateOptionDeltaNetWorth(option, preHoldings, preCash, prePrices) {
    var cost = typeof option.cost === 'number' ? option.cost : 0;
    var cashAdjustment = typeof option.cashAdjustment === 'number' ? option.cashAdjustment : 0;
    var priceChanges = option.priceChanges || {};
    var sharesDelta = option.sharesDelta || {};

    // Delta NW = (Post Cash - Pre Cash) + (Post Stock Value - Pre Stock Value)
    // Post Cash = Pre Cash - cost + cashAdjustment - (cost of buying any new shares at pre price)
    var sharePurchaseCost = 0;
    for (var compId in sharesDelta) {
      var dQty = sharesDelta[compId] || 0;
      var p = prePrices[compId] || 0;
      sharePurchaseCost += dQty * p; // positive dQty spends cash, negative gives cash
    }

    var deltaCash = -cost + cashAdjustment - sharePurchaseCost;

    // Stock value delta:
    // Pre Stock Value = sum( preQty * prePrice )
    // Post Stock Value = sum( (preQty + deltaQty) * (prePrice + deltaPrice) )
    var deltaStockValue = 0;
    for (var cId in prePrices) {
      var preQty = preHoldings[cId] || 0;
      var dQty2 = sharesDelta[cId] || 0;
      var postQty = preQty + dQty2;
      var preP = prePrices[cId] || 0;
      var dP = priceChanges[cId] || 0;
      var postP = preP + dP;

      var preVal = preQty * preP;
      var postVal = postQty * postP;
      deltaStockValue += (postVal - preVal);
    }

    // Delta NW
    return deltaCash + deltaStockValue;
  }

  /**
   * Metric 2: Decision Quality — 30 points
   * Six events, worth 5 points each.
   * For each event:
   *   Evaluate every available option using the team's own holdings immediately before that event.
   *   Calculate net-worth change each option would cause, including cost.
   *   Chosen = net-worth change resulting from team's choice.
   *   Best = greatest net-worth change among available options.
   *   Worst = smallest net-worth change among available options.
   * 
   * Neutral score conditions:
   *   If team owns NONE of the shares affected by the event -> 2.5 points.
   *   If Best equals Worst -> 2.5 points.
   *   Otherwise: 5 * (Chosen - Worst) / (Best - Worst).
   * 
   * Sum all 6 event scores = DQ out of 30.
   * 
   * @param {Object} team
   * @param {Array} events - 6 events with { id, affectedCompanies: [], options: [], ... }
   * @param {Object} eventLogs - Map of eventId -> { [teamId]: { chosenOptionId, preHoldings, preCash, prePrices } }
   * @returns {Object} { totalScore, eventScores: [ { eventId, chosen, best, worst, score, reason } ] }
   */
  function calculateDecisionQualityForTeam(team, events, eventLogs) {
    var eventScores = [];
    var totalScore = 0;

    for (var eIdx = 0; eIdx < events.length; eIdx++) {
      var ev = events[eIdx];
      var teamLog = (eventLogs && eventLogs[ev.id] && eventLogs[ev.id][team.id]) ? eventLogs[ev.id][team.id] : null;

      // Extract pre-event state
      var preHoldings = (teamLog && teamLog.preHoldings) ? teamLog.preHoldings : (team.startingHoldings || team.holdings || {});
      var preCash = (teamLog && typeof teamLog.preCash === 'number') ? teamLog.preCash : (team.startingCash || team.cash || 0);
      var prePrices = (teamLog && teamLog.prePrices) ? teamLog.prePrices : {};

      // Check if team owns none of the shares affected by the event
      var affectedCompanies = ev.affectedCompanies || [];
      var totalAffectedSharesOwned = 0;
      for (var a = 0; a < affectedCompanies.length; a++) {
        var compTicker = affectedCompanies[a];
        totalAffectedSharesOwned += (preHoldings[compTicker] || 0);
      }

      var chosenOptionId = teamLog ? teamLog.chosenOptionId : null;
      var options = ev.options || [];

      // Calculate net worth change for all options
      var optionDeltas = [];
      var chosenDelta = null;

      for (var o = 0; o < options.length; o++) {
        var opt = options[o];
        var delta = calculateOptionDeltaNetWorth(opt, preHoldings, preCash, prePrices);
        optionDeltas.push({
          optionId: opt.id,
          name: opt.name,
          deltaNW: delta
        });

        if (opt.id === chosenOptionId) {
          chosenDelta = delta;
        }
      }

      // If no choice was made or choice not found, default chosenDelta to worst or 0
      if (chosenDelta === null && optionDeltas.length > 0) {
        chosenDelta = optionDeltas[0].deltaNW;
      }

      var bestDelta = -Infinity;
      var worstDelta = Infinity;
      for (var od = 0; od < optionDeltas.length; od++) {
        if (optionDeltas[od].deltaNW > bestDelta) bestDelta = optionDeltas[od].deltaNW;
        if (optionDeltas[od].deltaNW < worstDelta) worstDelta = optionDeltas[od].deltaNW;
      }

      var score = 0;
      var neutralReason = null;

      if (affectedCompanies.length > 0 && totalAffectedSharesOwned === 0) {
        score = 2.5;
        neutralReason = 'Team owned 0 shares of affected companies (' + affectedCompanies.join(', ') + ')';
      } else if (Math.abs(bestDelta - worstDelta) < 1e-9) {
        score = 2.5;
        neutralReason = 'Best option delta equals Worst option delta (' + bestDelta.toFixed(2) + ')';
      } else {
        score = 5 * (chosenDelta - worstDelta) / (bestDelta - worstDelta);
        // Ensure within [0, 5] bounds if floating precision slightly deviates
        if (score < 0) score = 0;
        if (score > 5) score = 5;
      }

      totalScore += score;

      eventScores.push({
        eventId: ev.id,
        eventName: ev.name,
        preHoldings: JSON.parse(JSON.stringify(preHoldings)),
        preCash: preCash,
        affectedCompanies: affectedCompanies,
        totalAffectedSharesOwned: totalAffectedSharesOwned,
        options: optionDeltas,
        chosenOptionId: chosenOptionId,
        chosenDelta: chosenDelta,
        bestDelta: bestDelta,
        worstDelta: worstDelta,
        score: score,
        neutralReason: neutralReason
      });
    }

    return {
      totalScore: totalScore,
      eventScores: eventScores
    };
  }

  /**
   * Metric 3: Risk Management — 20 points
   * Diversification (10 points) + Downside Control (10 points)
   * 
   * Diversification:
   *   Count distinct companies held after Phase 1 (starting portfolio where quantity > 0)
   *   3 companies = 4 points
   *   4 companies = 6 points
   *   5 companies = 8 points
   *   6 companies = 10 points
   *   < 3 companies = 0 points.
   * 
   * Downside Control:
   *   Calculate team's aggregate loss across the three Bad Events.
   *   Loss in bad event = max(0, -deltaNW)
   *   Team Loss = sum of losses across the 3 Bad Events.
   *   Downside Control = 10 * (1 - Team Loss / Largest Loss in Room)
   *   Team that gains or breaks even receives 10 points.
   *   If nobody lost money, everyone receives 10 points.
   *   Clamped between 0 and 10 points.
   * 
   * @param {Array} teams
   * @param {Array} events - The 6 events, exactly 3 marked isBadEvent: true
   * @param {Object} eventLogs
   * @returns {Object} Map of team.id -> { diversificationScore, downsideControlScore, distinctCompaniesCount, teamLoss, largestLossInRoom, totalScore }
   */
  function calculateRiskManagement(teams, events, eventLogs) {
    var results = {};
    if (!teams || teams.length === 0) return results;

    // 1. Diversification calculation
    var divScores = {};
    var distinctCounts = {};

    teams.forEach(function (team) {
      var startingHoldings = team.startingHoldings || team.holdings || {};
      var count = 0;
      for (var compId in startingHoldings) {
        if (startingHoldings[compId] > 0) {
          count++;
        }
      }
      distinctCounts[team.id] = count;

      var divPts = 0;
      if (count === 3) divPts = 4;
      else if (count === 4) divPts = 6;
      else if (count === 5) divPts = 8;
      else if (count >= 6) divPts = 10;
      else divPts = 0; // Fewer than 3

      divScores[team.id] = divPts;
    });

    // 2. Downside Control calculation
    var badEvents = events.filter(function (e) { return !!e.isBadEvent; });
    var teamLosses = {};
    var badEventBreakdown = {};
    var largestLossInRoom = 0;

    teams.forEach(function (team) {
      var totalLoss = 0;
      var breakdowns = [];

      badEvents.forEach(function (badEv) {
        var teamLog = (eventLogs && eventLogs[badEv.id] && eventLogs[badEv.id][team.id]) ? eventLogs[badEv.id][team.id] : null;
        var deltaNW = 0;
        if (teamLog && typeof teamLog.deltaNW === 'number') {
          deltaNW = teamLog.deltaNW;
        } else if (teamLog && teamLog.chosenOptionId) {
          var opt = (badEv.options || []).find(function (o) { return o.id === teamLog.chosenOptionId; });
          if (opt) {
            deltaNW = calculateOptionDeltaNetWorth(
              opt,
              teamLog.preHoldings || team.startingHoldings || {},
              teamLog.preCash || team.startingCash || 0,
              teamLog.prePrices || {}
            );
          }
        }

        // Loss is positive when net worth decreased
        var loss = deltaNW < 0 ? -deltaNW : 0;
        totalLoss += loss;

        breakdowns.push({
          eventId: badEv.id,
          eventName: badEv.name,
          deltaNW: deltaNW,
          loss: loss
        });
      });

      teamLosses[team.id] = totalLoss;
      badEventBreakdown[team.id] = breakdowns;

      if (totalLoss > largestLossInRoom) {
        largestLossInRoom = totalLoss;
      }
    });

    // Compute downside control points
    teams.forEach(function (team) {
      var tLoss = teamLosses[team.id];
      var downsidePts = 10;

      if (largestLossInRoom === 0 || tLoss <= 0) {
        downsidePts = 10;
      } else {
        downsidePts = 10 * (1 - (tLoss / largestLossInRoom));
        if (downsidePts < 0) downsidePts = 0;
        if (downsidePts > 10) downsidePts = 10;
      }

      var totalRisk = divScores[team.id] + downsidePts;

      results[team.id] = {
        distinctCompaniesCount: distinctCounts[team.id],
        diversificationScore: divScores[team.id],
        badEventLosses: badEventBreakdown[team.id],
        teamLoss: tLoss,
        largestLossInRoom: largestLossInRoom,
        downsideControlScore: downsidePts,
        totalScore: totalRisk
      };
    });

    return results;
  }

  /**
   * Judge Scoring calculation
   * Top 5 teams only. Each judge awards 3 binary scores:
   * - clarity: 0 or 1
   * - justification: 0 or 1
   * - qaAnswer: 0 or 1
   * Each judge bonus = 0..3.
   * If multiple judges, average their bonuses and round to nearest whole integer (0..3).
   * Teams outside top 5 receive 0 points.
   * 
   * @param {string} teamId
   * @param {boolean} isTop5
   * @param {Array} judgeEntries - Array of { judgeName, clarity (0/1), justification (0/1), qaAnswer (0/1) }
   * @returns {Object} { judgeBonus: number, details: Array }
   */
  function calculateJudgeBonus(teamId, isTop5, judgeEntries) {
    if (!isTop5 || !judgeEntries || judgeEntries.length === 0) {
      return { judgeBonus: 0, details: [] };
    }

    var totalSum = 0;
    var details = [];

    for (var i = 0; i < judgeEntries.length; i++) {
      var j = judgeEntries[i];
      var c = j.clarity === 1 ? 1 : 0;
      var ju = j.justification === 1 ? 1 : 0;
      var q = j.qaAnswer === 1 ? 1 : 0;
      var sum = c + ju + q;
      totalSum += sum;
      details.push({
        judgeName: j.judgeName || ('Judge ' + (i + 1)),
        clarity: c,
        justification: ju,
        qaAnswer: q,
        bonus: sum
      });
    }

    var avg = totalSum / judgeEntries.length;
    var finalBonus = Math.round(avg);
    if (finalBonus < 0) finalBonus = 0;
    if (finalBonus > 3) finalBonus = 3;

    return {
      judgeBonus: finalBonus,
      average: avg,
      details: details
    };
  }

  /**
   * Full simulation scoring pipeline.
   * Evaluates all teams across Metric 1, Metric 2, Metric 3, Automatic Score, Top 5 Selection, and Final Scores.
   * 
   * @param {Array} teams
   * @param {Array} companies
   * @param {Array} events
   * @param {Object} eventLogs
   * @param {Object} judgeScoresByTeam - { [teamId]: [ judgeEntries ] }
   * @returns {Object} Complete evaluation report
   */
  function evaluateSimulation(teams, companies, events, eventLogs, judgeScoresByTeam) {
    if (!teams || teams.length === 0) {
      return { leaderboard: [], top5: [], auditData: {} };
    }

    judgeScoresByTeam = judgeScoresByTeam || {};

    // 1. Metric 1: Financial Return
    var finReturnResults = calculateFinancialReturn(teams, companies);

    // 2. Metric 2: Decision Quality
    var dqResults = {};
    teams.forEach(function (team) {
      dqResults[team.id] = calculateDecisionQualityForTeam(team, events, eventLogs);
    });

    // 3. Metric 3: Risk Management
    var riskResults = calculateRiskManagement(teams, events, eventLogs);

    // 4. Automatic Scores
    var evaluatedTeams = teams.map(function (team) {
      var fin = finReturnResults[team.id] || { points: 0, finalNetWorth: 0, rank: 0 };
      var dq = dqResults[team.id] || { totalScore: 0, eventScores: [] };
      var risk = riskResults[team.id] || { totalScore: 0, diversificationScore: 0, downsideControlScore: 0 };

      var autoScore = fin.points + dq.totalScore + risk.totalScore;

      return {
        id: team.id,
        name: team.name,
        cash: typeof team.cash === 'number' ? team.cash : 0,
        finalNetWorth: fin.finalNetWorth,
        financialReturn: fin.points,
        financialReturnRank: fin.rank,
        decisionQuality: dq.totalScore,
        decisionQualityDetails: dq.eventScores,
        riskManagement: risk.totalScore,
        diversification: risk.diversificationScore,
        downsideControl: risk.downsideControlScore,
        riskDetails: risk,
        automaticScore: autoScore,
        judgeBonus: 0,
        finalScore: autoScore,
        isTop5: false,
        tieBreakNotes: ''
      };
    });

    // Sort to determine Top 5 by Automatic Score
    // Tie-breaker for 5th place:
    // 1. Higher Financial Return points.
    // 2. Higher remaining cash.
    // 3. Marked for organizer resolution.
    evaluatedTeams.sort(function (a, b) {
      if (Math.abs(b.automaticScore - a.automaticScore) > 1e-9) {
        return b.automaticScore - a.automaticScore;
      }
      // Tie-breaker 1: Financial Return
      if (Math.abs(b.financialReturn - a.financialReturn) > 1e-9) {
        return b.financialReturn - a.financialReturn;
      }
      // Tie-breaker 2: Remaining Cash
      if (Math.abs(b.cash - a.cash) > 1e-9) {
        return b.cash - a.cash;
      }
      return 0; // Exact tie
    });

    // Identify Top 5
    var top5Count = Math.min(5, evaluatedTeams.length);
    for (var t = 0; t < top5Count; t++) {
      evaluatedTeams[t].isTop5 = true;
    }

    // Check if 5th place is tied with 6th place
    if (evaluatedTeams.length > 5) {
      var fifth = evaluatedTeams[4];
      var sixth = evaluatedTeams[5];
      if (Math.abs(fifth.automaticScore - sixth.automaticScore) < 1e-9 &&
          Math.abs(fifth.financialReturn - sixth.financialReturn) < 1e-9 &&
          Math.abs(fifth.cash - sixth.cash) < 1e-9) {
        fifth.tieBreakNotes = 'Unresolved tie for 5th place with ' + sixth.name + ' (Requires Organizer Call)';
        sixth.tieBreakNotes = 'Unresolved tie for 5th place with ' + fifth.name + ' (Requires Organizer Call)';
      }
    }

    // 5. Judge Scoring (Only Top 5 receive judge bonus)
    evaluatedTeams.forEach(function (team) {
      if (team.isTop5) {
        var jEntries = judgeScoresByTeam[team.id] || [];
        var jResult = calculateJudgeBonus(team.id, true, jEntries);
        team.judgeBonus = jResult.judgeBonus;
        team.judgeDetails = jResult.details;
      } else {
        team.judgeBonus = 0;
        team.judgeDetails = [];
      }
      team.finalScore = team.automaticScore + team.judgeBonus;
    });

    // Final sorting for final leaderboard by Final Score
    // Final-score ties resolved by:
    // 1. Higher Financial Return points.
    // 2. Higher remaining cash.
    // 3. One-question judge call.
    var finalLeaderboard = evaluatedTeams.slice().sort(function (a, b) {
      if (Math.abs(b.finalScore - a.finalScore) > 1e-9) {
        return b.finalScore - a.finalScore;
      }
      // Tie-break 1: Financial Return
      if (Math.abs(b.financialReturn - a.financialReturn) > 1e-9) {
        return b.financialReturn - a.financialReturn;
      }
      // Tie-break 2: Remaining Cash
      if (Math.abs(b.cash - a.cash) > 1e-9) {
        return b.cash - a.cash;
      }
      // Exact tie - marked for judge call
      return 0;
    });

    // Assign final ranks
    var currentRank = 1;
    for (var rIdx = 0; rIdx < finalLeaderboard.length; rIdx++) {
      if (rIdx > 0) {
        var prev = finalLeaderboard[rIdx - 1];
        var curr = finalLeaderboard[rIdx];
        if (Math.abs(prev.finalScore - curr.finalScore) < 1e-9 &&
            Math.abs(prev.financialReturn - curr.financialReturn) < 1e-9 &&
            Math.abs(prev.cash - curr.cash) < 1e-9) {
          curr.finalRank = prev.finalRank;
          curr.isFinalTie = true;
          prev.isFinalTie = true;
          curr.tieBreakNotes = 'Tied at final score with ' + prev.name + ' (One-Question Judge Call Required)';
        } else {
          curr.finalRank = rIdx + 1;
        }
      } else {
        finalLeaderboard[0].finalRank = 1;
      }
    }

    var top5Teams = finalLeaderboard.filter(function (t) { return t.isTop5; });

    return {
      leaderboard: finalLeaderboard,
      top5: top5Teams,
      auditData: {
        finReturnResults: finReturnResults,
        dqResults: dqResults,
        riskResults: riskResults
      }
    };
  }

  return {
    calculateFinalNetWorth: calculateFinalNetWorth,
    calculateFinancialReturn: calculateFinancialReturn,
    calculateOptionDeltaNetWorth: calculateOptionDeltaNetWorth,
    calculateDecisionQualityForTeam: calculateDecisionQualityForTeam,
    calculateRiskManagement: calculateRiskManagement,
    calculateJudgeBonus: calculateJudgeBonus,
    evaluateSimulation: evaluateSimulation
  };
}));
