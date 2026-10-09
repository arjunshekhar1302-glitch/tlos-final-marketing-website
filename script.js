/**
 * TLOS — The Market Simulation Application Controller
 * High-performance vanilla JavaScript controller with persistent localStorage state,
 * full view rendering, modal management, CSV import/export, Web Audio chime, and PDF generation.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'TLOS_SIMULATION_STATE_V1';

  // Application State
  var state = {
    teams: [],
    companies: [],
    events: [],
    eventLogs: {}, // eventId -> { [teamId]: { chosenOptionId, preHoldings, preCash, prePrices, deltaNW } }
    judgeScores: {}, // teamId -> [ { judgeName, clarity, justification, qaAnswer } ]
    judgesList: ['Judge Anderson', 'Judge Sterling', 'Judge Mehta'],
    activeEventIndex: 0,
    isFinalized: false,
    activeView: 'overview',
    stageCurrentTeamIndex: 0,
    currentReportTeamId: null,
    currentAuditTeamId: null,
    timer: {
      totalSeconds: 300,
      remainingSeconds: 300,
      intervalId: null,
      isRunning: false
    }
  };

  // Evaluation cache
  var evaluationCache = null;

  // Audio Context for Timer Chime
  var audioCtx = null;
  function playChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var now = audioCtx.currentTime;
      var osc1 = audioCtx.createOscillator();
      var gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.3); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      var osc2 = audioCtx.createOscillator();
      var gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.3);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.6); // D6
      gain2.gain.setValueAtTime(0.2, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.log('Audio chime not supported or muted:', e);
    }
  }

  // Formatting helpers
  function formatCurrency(val) {
    if (typeof val !== 'number' || isNaN(val)) return '$0.00';
    return (val < 0 ? '-$' : '$') + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatPoints(val) {
    if (typeof val !== 'number' || isNaN(val)) return '0.00';
    return val.toFixed(2);
  }

  // Persistence
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      evaluationCache = null; // Invalidate cache
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.companies) && Array.isArray(parsed.events)) {
          state = parsed;
          // Ensure timer is not running after page refresh
          state.timer.isRunning = false;
          state.timer.intervalId = null;
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return false;
  }

  function loadDemoData(force) {
    if (!force && state.teams.length > 0) {
      if (!confirm('This will overwrite current simulation data with the official 10-team demo dataset. Continue?')) {
        return;
      }
    }

    var defaultData = window.TLOSDefaultData;
    if (!defaultData) return;

    state.companies = JSON.parse(JSON.stringify(defaultData.DEFAULT_COMPANIES));
    state.events = JSON.parse(JSON.stringify(defaultData.DEFAULT_EVENTS));
    state.teams = JSON.parse(JSON.stringify(defaultData.DEMO_TEAMS));
    state.eventLogs = JSON.parse(JSON.stringify(defaultData.DEMO_EVENT_LOGS));
    state.judgeScores = JSON.parse(JSON.stringify(defaultData.DEMO_JUDGE_SCORES));
    state.judgesList = ['Judge Anderson (FinTech Lead)', 'Judge Sterling (Macro Hedge Partner)', 'Judge Mehta (Quantitative Academic)'];
    state.activeEventIndex = 0;
    state.isFinalized = true;
    state.stageCurrentTeamIndex = 0;
    state.currentReportTeamId = state.teams[0] ? state.teams[0].id : null;
    state.currentAuditTeamId = state.teams[0] ? state.teams[0].id : null;

    saveState();
    renderAll();
    showToast('Demo data loaded successfully!');
  }

  // Evaluates simulation
  function getEvaluation() {
    if (!evaluationCache) {
      evaluationCache = window.TLOSScoring.evaluateSimulation(
        state.teams,
        state.companies,
        state.events,
        state.eventLogs,
        state.judgeScores
      );
    }
    return evaluationCache;
  }

  // Toast notification
  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'status-badge info';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '99999';
    toast.style.padding = '10px 18px';
    toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
    toast.style.backgroundColor = 'var(--bg-surface)';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // Navigation
  function navigateTo(viewId) {
    state.activeView = viewId;
    var tabBtns = document.querySelectorAll('.nav-tab-btn');
    tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    var viewPanels = document.querySelectorAll('.view-panel');
    viewPanels.forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'view-' + viewId);
    });

    // View specific refresh
    if (viewId === 'overview') renderOverview();
    else if (viewId === 'teams') renderTeams();
    else if (viewId === 'companies') renderCompanies();
    else if (viewId === 'events') renderEvents();
    else if (viewId === 'sim-control') renderSimControl();
    else if (viewId === 'leaderboard') renderLeaderboard();
    else if (viewId === 'score-audit') renderScoreAudit();
    else if (viewId === 'top-5') renderTop5();
    else if (viewId === 'stage-round') renderStageRound();
    else if (viewId === 'judge-scoring') renderJudgeScoring();
    else if (viewId === 'final-results') renderFinalResults();
    else if (viewId === 'reports') renderReports();
    else if (viewId === 'backup') renderBackup();
  }

  // Modal helpers
  function openModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  }

  function closeModal(modalId) {
    var el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }

  // -------------------------------------------------------------
  // RENDERING FUNCTIONS
  // -------------------------------------------------------------

  function renderHeaderStatus() {
    var evalRes = getEvaluation();
    var simBadge = document.getElementById('badge-sim-status');
    var lockBadge = document.getElementById('badge-lock-status');
    var countBadge = document.getElementById('badge-team-count');

    if (countBadge) countBadge.textContent = state.teams.length + ' Teams Registered';

    if (state.isFinalized) {
      simBadge.className = 'status-badge finalized';
      simBadge.textContent = '★ Round Finalized';
      lockBadge.className = 'status-badge finalized';
      lockBadge.textContent = 'Official Standings Published';
    } else {
      simBadge.className = 'status-badge live';
      simBadge.textContent = '● Phase: Live Simulation';
      lockBadge.className = 'status-badge info';
      lockBadge.textContent = 'Leaderboard: In Progress';
    }

    var navTeams = document.getElementById('nav-count-teams');
    if (navTeams) navTeams.textContent = state.teams.length;
    var navCos = document.getElementById('nav-count-companies');
    if (navCos) navCos.textContent = state.companies.length;
  }

  function renderOverview() {
    var evalRes = getEvaluation();
    document.getElementById('stat-total-teams').textContent = state.teams.length;
    document.getElementById('stat-total-companies').textContent = state.companies.length;
    
    // Count completed events
    var completedCount = state.events.filter(function (e) { return e.status === 'completed'; }).length;
    document.getElementById('stat-events-progress').textContent = completedCount + ' / 6';

    var totalNW = 0;
    evalRes.leaderboard.forEach(function (t) { totalNW += t.finalNetWorth; });
    document.getElementById('stat-market-networth').textContent = formatCurrency(totalNW);

    var finalizeBtn = document.getElementById('btn-quick-finalize');
    if (finalizeBtn) {
      finalizeBtn.textContent = state.isFinalized ? 'Unfinalize Simulation' : 'Finalize Simulation Results';
      finalizeBtn.className = state.isFinalized ? 'btn btn-outline btn-sm' : 'btn btn-warning btn-sm';
    }
  }

  function renderTeams() {
    var tbody = document.getElementById('tbody-teams');
    tbody.innerHTML = '';

    state.teams.forEach(function (team, idx) {
      var holdings = team.startingHoldings || team.holdings || {};
      var holdingsParts = [];
      var distinctCount = 0;

      for (var cId in holdings) {
        var qty = holdings[cId];
        if (qty > 0) {
          distinctCount++;
          holdingsParts.push(cId + ': ' + qty);
        }
      }

      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono">${team.id}</td>
        <td><strong>${escapeHtml(team.name)}</strong></td>
        <td class="text-right font-mono">${formatCurrency(team.startingCash)}</td>
        <td class="text-right font-mono">${formatCurrency(team.cash)}</td>
        <td style="font-size: 12px; color: var(--text-secondary); max-width: 320px;">
          ${holdingsParts.length > 0 ? holdingsParts.join(' • ') : '<span style="color:var(--text-muted)">None</span>'}
        </td>
        <td class="text-center font-mono"><span class="badge ${distinctCount >= 3 ? 'badge-normal' : 'badge-bad'}">${distinctCount} Cos</span></td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick="app.openEditTeamModal('${team.id}')">Edit</button>
          <button class="btn btn-outline btn-sm" style="color: var(--market-red);" onclick="app.deleteTeam('${team.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (state.teams.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted);">No teams registered. Click "+ Add New Team" or "Load Demo Data".</td></tr>`;
    }
  }

  function renderCompanies() {
    var tbody = document.getElementById('tbody-companies');
    tbody.innerHTML = '';

    // Calculate aggregate market holdings across all teams
    var aggregateHoldings = {};
    var holdingTeamsCount = {};
    state.companies.forEach(function (c) {
      aggregateHoldings[c.id] = 0;
      holdingTeamsCount[c.id] = 0;
    });

    state.teams.forEach(function (t) {
      var h = t.holdings || t.startingHoldings || {};
      for (var cId in h) {
        var q = h[cId] || 0;
        if (q > 0) {
          aggregateHoldings[cId] = (aggregateHoldings[cId] || 0) + q;
          holdingTeamsCount[cId] = (holdingTeamsCount[cId] || 0) + 1;
        }
      }
    });

    state.companies.forEach(function (comp) {
      var totalShares = aggregateHoldings[comp.id] || 0;
      var numTeams = holdingTeamsCount[comp.id] || 0;

      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono"><strong>${comp.ticker}</strong></td>
        <td><strong>${escapeHtml(comp.name)}</strong></td>
        <td><span class="badge badge-normal">${escapeHtml(comp.sector || 'General')}</span></td>
        <td class="text-right font-mono">${formatCurrency(comp.startingPrice)}</td>
        <td class="text-right font-mono">${formatCurrency(comp.currentPrice)}</td>
        <td class="text-right font-mono val-gold">${formatCurrency(comp.frozenFinalPrice)}</td>
        <td class="text-center font-mono">
          <strong>${totalShares.toLocaleString()}</strong> shares
          <span style="font-size: 11px; color: var(--text-muted); display: block;">(${numTeams} teams)</span>
        </td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick="app.openEditCompanyModal('${comp.id}')">Edit Prices</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (state.companies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted);">No companies listed.</td></tr>`;
    }
  }

  function renderEvents() {
    var container = document.getElementById('events-accordion-container');
    container.innerHTML = '';

    state.events.forEach(function (ev, idx) {
      var card = document.createElement('div');
      card.className = 'card';
      card.style.borderLeft = ev.isBadEvent ? '4px solid var(--badge-bad-event)' : '4px solid var(--accent-blue)';

      var optionsHtml = ev.options.map(function (opt) {
        var priceDeltas = [];
        for (var t in opt.priceChanges) {
          var p = opt.priceChanges[t];
          priceDeltas.push(`${t}: ${p >= 0 ? '+' : ''}${formatCurrency(p)}`);
        }
        return `
          <div style="background: var(--bg-surface); padding: 10px 14px; border-radius: var(--radius-sm); margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: var(--accent-cyan); font-size: 13px;">${escapeHtml(opt.name)}</strong>
              <span class="font-mono" style="font-size: 12px; color: ${opt.cost > 0 ? 'var(--market-red)' : 'var(--text-muted)'};">
                Cost: ${formatCurrency(opt.cost)}
              </span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${escapeHtml(opt.description || '')}</p>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
              Price Impact: ${priceDeltas.length > 0 ? priceDeltas.join(', ') : 'None'}
            </div>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="badge badge-normal">Event ${ev.order || idx + 1}</span>
              ${ev.isBadEvent ? '<span class="badge badge-bad">⚠️ Bad Event</span>' : '<span class="badge badge-normal">Standard Event</span>'}
              <span class="badge ${ev.status === 'completed' ? 'badge-normal' : 'badge-bad'}" style="text-transform: capitalize;">${ev.status || 'pending'}</span>
            </div>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-main);">${escapeHtml(ev.name)}</h3>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="app.openEditEventModal('${ev.id}')">Configure Event</button>
          </div>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">${escapeHtml(ev.description)}</p>
        <div style="font-size: 12px; margin-bottom: 12px;">
          <strong style="color: var(--text-muted); text-transform: uppercase; font-size: 11px;">Affected Companies:</strong>
          <span style="color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 600; margin-left: 6px;">
            ${(ev.affectedCompanies && ev.affectedCompanies.length > 0) ? ev.affectedCompanies.join(', ') : 'None'}
          </span>
        </div>
        <div class="card-title" style="font-size: 13px; margin-bottom: 6px;">Available Decision Options</div>
        <div>${optionsHtml}</div>
      `;
      container.appendChild(card);
    });
  }

  function renderSimControl() {
    var activeEv = state.events[state.activeEventIndex] || state.events[0];
    if (!activeEv) return;

    // Render stepper buttons
    var stepper = document.getElementById('event-stepper-buttons');
    stepper.innerHTML = '';
    state.events.forEach(function (ev, idx) {
      var btn = document.createElement('button');
      btn.className = `btn btn-sm ${idx === state.activeEventIndex ? 'btn-cyan' : 'btn-outline'}`;
      btn.innerHTML = `Ev ${idx + 1} ${ev.status === 'completed' ? '✓' : ''}`;
      btn.onclick = function () {
        state.activeEventIndex = idx;
        renderSimControl();
      };
      stepper.appendChild(btn);
    });

    // Render lock status
    var lockContainer = document.getElementById('current-event-lock-status');
    if (activeEv.status === 'completed') {
      lockContainer.innerHTML = '<span class="status-badge live">🔒 Event Locked & Completed</span>';
    } else {
      lockContainer.innerHTML = '<span class="status-badge info">🔓 Event Active (Logging Choices)</span>';
    }

    // Active event card info
    var infoCard = document.getElementById('card-active-event-info');
    infoCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="badge ${activeEv.isBadEvent ? 'badge-bad' : 'badge-normal'}">
          ${activeEv.isBadEvent ? '⚠️ Bad Event (' + (activeEv.order || state.activeEventIndex + 1) + ' of 3)' : 'Standard Event'}
        </span>
        <span style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
          Affected Companies: ${(activeEv.affectedCompanies || []).join(', ') || 'None'}
        </span>
      </div>
      <h2 style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(activeEv.name)}</h2>
      <p style="font-size: 13px; color: var(--text-secondary);">${escapeHtml(activeEv.description)}</p>
    `;

    // Render decision matrix table
    var tbody = document.getElementById('tbody-decision-matrix');
    tbody.innerHTML = '';

    var logsForEvent = state.eventLogs[activeEv.id] || {};

    state.teams.forEach(function (team) {
      var log = logsForEvent[team.id] || null;
      var preHoldings = (log && log.preHoldings) ? log.preHoldings : (team.holdings || team.startingHoldings || {});
      var preCash = (log && typeof log.preCash === 'number') ? log.preCash : team.cash;
      
      // Calculate affected shares owned
      var affShares = 0;
      (activeEv.affectedCompanies || []).forEach(function (c) {
        affShares += (preHoldings[c] || 0);
      });

      var chosenOptId = log ? log.chosenOptionId : (activeEv.options[0] ? activeEv.options[0].id : '');
      var chosenOpt = activeEv.options.find(function (o) { return o.id === chosenOptId; }) || activeEv.options[0];

      // Current prePrices snapshot
      var prePrices = {};
      state.companies.forEach(function (c) { prePrices[c.id] = c.currentPrice; });

      var deltaNW = chosenOpt ? window.TLOSScoring.calculateOptionDeltaNetWorth(chosenOpt, preHoldings, preCash, prePrices) : 0;

      var selectOptionsHtml = activeEv.options.map(function (opt) {
        var optDelta = window.TLOSScoring.calculateOptionDeltaNetWorth(opt, preHoldings, preCash, prePrices);
        var selected = (opt.id === chosenOptId) ? 'selected' : '';
        return `<option value="${opt.id}" ${selected}>${escapeHtml(opt.name)} (Cost: ${formatCurrency(opt.cost)} | &Delta;NW: ${formatCurrency(optDelta)})</option>`;
      }).join('');

      var isLocked = activeEv.status === 'completed';

      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(team.name)}</strong></td>
        <td class="font-mono">${formatCurrency(preCash)}</td>
        <td class="font-mono">
          <span class="badge ${affShares === 0 ? 'badge-bad' : 'badge-normal'}">${affShares} shares</span>
        </td>
        <td>
          <select class="form-control" style="font-size: 12px; min-width: 260px;" id="select-opt-${team.id}" ${isLocked ? 'disabled' : ''} onchange="app.previewTeamOptionChoice('${activeEv.id}', '${team.id}', this.value)">
            ${selectOptionsHtml}
          </select>
        </td>
        <td class="text-right font-mono" id="cost-${team.id}">${formatCurrency(chosenOpt ? chosenOpt.cost : 0)}</td>
        <td class="text-right font-mono ${deltaNW >= 0 ? 'val-positive' : 'val-negative'}" id="delta-${team.id}">
          ${(deltaNW >= 0 ? '+' : '') + formatCurrency(deltaNW)}
        </td>
        <td class="text-center font-mono">
          ${log ? '<span class="status-badge live">Saved</span>' : '<span class="status-badge info">Pending</span>'}
        </td>
        <td class="text-center">
          <button class="btn btn-cyan btn-sm" ${isLocked ? 'disabled' : ''} onclick="app.submitTeamChoice('${activeEv.id}', '${team.id}')">Submit</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderLeaderboard() {
    var evalRes = getEvaluation();
    var tbody = document.getElementById('tbody-leaderboard');
    tbody.innerHTML = '';

    var maskedAlert = document.getElementById('leaderboard-masked-alert');
    if (maskedAlert) {
      maskedAlert.style.display = state.isFinalized ? 'none' : 'block';
    }

    evalRes.leaderboard.forEach(function (team, idx) {
      var rankBadgeClass = 'badge-rank';
      if (team.finalRank === 1) rankBadgeClass = 'badge-rank badge-rank-1';
      else if (team.finalRank === 2) rankBadgeClass = 'badge-rank badge-rank-2';
      else if (team.finalRank === 3) rankBadgeClass = 'badge-rank badge-rank-3';

      var tr = document.createElement('tr');

      if (!state.isFinalized) {
        // Pre-finalization participant-safe masked mode
        tr.innerHTML = `
          <td class="text-center"><span class="${rankBadgeClass}">${team.finalRank || idx + 1}</span></td>
          <td><strong>${escapeHtml(team.name)}</strong></td>
          <td class="text-right font-mono">${formatCurrency(team.finalNetWorth)}</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td class="text-right font-mono" style="color: var(--text-muted);">&bull;&bull;&bull;</td>
          <td><span class="status-badge info">Unfinalized</span></td>
        `;
      } else {
        // Post-finalization full breakdown mode
        tr.innerHTML = `
          <td class="text-center"><span class="${rankBadgeClass}">${team.finalRank || idx + 1}</span></td>
          <td><strong>${escapeHtml(team.name)}</strong></td>
          <td class="text-right font-mono">${formatCurrency(team.finalNetWorth)}</td>
          <td class="text-right font-mono">${formatPoints(team.financialReturn)}</td>
          <td class="text-right font-mono">${formatPoints(team.decisionQuality)}</td>
          <td class="text-right font-mono" title="Div: ${team.diversification} pts | Downside: ${formatPoints(team.downsideControl)} pts">${formatPoints(team.riskManagement)}</td>
          <td class="text-right font-mono val-cyan">${formatPoints(team.automaticScore)}</td>
          <td class="text-right font-mono ${team.judgeBonus > 0 ? 'val-gold' : ''}">+${team.judgeBonus}</td>
          <td class="text-right font-mono val-gold" style="font-size: 15px;">${formatPoints(team.finalScore)}</td>
          <td>
            ${team.isTop5 ? '<span class="status-badge live">Top 5 Finalist</span> ' : ''}
            ${team.tieBreakNotes ? '<span class="badge badge-bad" title="' + escapeHtml(team.tieBreakNotes) + '">Tie Call</span>' : ''}
          </td>
        `;
      }
      tbody.appendChild(tr);
    });
  }

  function renderScoreAudit() {
    var select = document.getElementById('select-audit-team');
    select.innerHTML = '';
    state.teams.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + ' (' + t.id + ')';
      if (t.id === state.currentAuditTeamId) opt.selected = true;
      select.appendChild(opt);
    });

    if (!state.currentAuditTeamId && state.teams.length > 0) {
      state.currentAuditTeamId = state.teams[0].id;
    }

    var currentTeam = state.teams.find(function (t) { return t.id === state.currentAuditTeamId; });
    if (!currentTeam) return;

    var evalRes = getEvaluation();
    var evaluatedTeam = evalRes.leaderboard.find(function (t) { return t.id === currentTeam.id; }) || {};
    var finData = evalRes.auditData.finReturnResults[currentTeam.id] || {};
    var dqData = evalRes.auditData.dqResults[currentTeam.id] || { eventScores: [] };
    var riskData = evalRes.auditData.riskResults[currentTeam.id] || {};

    // Metric 1 content
    document.getElementById('audit-fin-points').textContent = formatPoints(finData.points || 0) + ' / 50 pts';
    var finContent = document.getElementById('audit-fin-content');
    var n = state.teams.length;
    var rank = finData.averageRank || finData.rank || 1;
    finContent.innerHTML = `
      <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
        <div><strong>Final Net Worth:</strong> <span class="font-mono val-cyan">${formatCurrency(finData.finalNetWorth)}</span></div>
        <div><strong>Assigned Evaluation Rank:</strong> <span class="font-mono">${rank}</span> (Number of teams N = ${n})</div>
        <div><strong>Formula:</strong> <code>50 &times; (${n} - ${rank}) / (${n} - 1) = ${formatPoints(finData.points || 0)} pts</code></div>
        ${finData.formulaInputs && finData.formulaInputs.tiedRanks && finData.formulaInputs.tiedRanks.length > 1 ? 
          `<div style="color: var(--accent-gold); margin-top: 4px;">⚠️ Tied across ranks [${finData.formulaInputs.tiedRanks.join(', ')}]. Received exact average rank ${rank}.</div>` : ''}
      </div>
    `;

    // Metric 2 DQ Table
    document.getElementById('audit-dq-points').textContent = formatPoints(evaluatedTeam.decisionQuality || 0) + ' / 30 pts';
    var dqTbody = document.getElementById('tbody-audit-dq');
    dqTbody.innerHTML = '';
    dqData.eventScores.forEach(function (es) {
      var holdingsStr = [];
      for (var c in es.preHoldings) {
        if (es.preHoldings[c] > 0) holdingsStr.push(c + ':' + es.preHoldings[c]);
      }
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(es.eventName)}</strong></td>
        <td class="font-mono" style="font-size: 11px;">${holdingsStr.join(', ') || '0'}</td>
        <td class="font-mono" style="font-size: 11px;">${es.chosenOptionId || 'Default'}</td>
        <td class="text-right font-mono">${formatCurrency(es.chosenDelta)}</td>
        <td class="text-right font-mono">${formatCurrency(es.bestDelta)}</td>
        <td class="text-right font-mono">${formatCurrency(es.worstDelta)}</td>
        <td style="font-size: 11px; color: var(--text-muted);">${es.neutralReason ? '<span class="badge badge-normal">' + escapeHtml(es.neutralReason) + '</span>' : 'Standard Formula'}</td>
        <td class="text-right font-mono val-gold">${formatPoints(es.score)}</td>
      `;
      dqTbody.appendChild(tr);
    });

    // Metric 3 Risk content
    document.getElementById('audit-risk-points').textContent = formatPoints(evaluatedTeam.riskManagement || 0) + ' / 20 pts';
    var riskContent = document.getElementById('audit-risk-content');
    riskContent.innerHTML = `
      <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
        <div style="margin-bottom: 8px;">
          <strong>Diversification (10 pts):</strong> Held <span class="font-mono val-cyan">${riskData.distinctCompaniesCount || 0}</span> distinct companies after Phase 1 &rarr; 
          <span class="font-mono val-gold">${riskData.diversificationScore || 0} pts</span>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">(3 cos=4, 4 cos=6, 5 cos=8, 6 cos=10, &lt;3=0)</span>
        </div>
        <div>
          <strong>Downside Control (10 pts across 3 Bad Events):</strong>
          Team Loss = <span class="font-mono val-negative">${formatCurrency(riskData.teamLoss || 0)}</span> | 
          Largest Loss in Room = <span class="font-mono val-negative">${formatCurrency(riskData.largestLossInRoom || 0)}</span> &rarr;
          <span class="font-mono val-gold">${formatPoints(riskData.downsideControlScore || 0)} pts</span>
        </div>
        <div class="font-mono" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
          Formula: 10 &times; (1 - ${formatCurrency(riskData.teamLoss || 0)} / ${formatCurrency(riskData.largestLossInRoom || 0)}) = ${formatPoints(riskData.downsideControlScore || 0)} pts
        </div>
      </div>
    `;

    // Raw JSON Inspector
    document.getElementById('audit-raw-json').textContent = JSON.stringify({
      team: currentTeam,
      auditData: evaluatedTeam,
      rawLogsForTeam: Object.keys(state.eventLogs).map(function (eId) {
        return { eventId: eId, log: state.eventLogs[eId][currentTeam.id] };
      })
    }, null, 2);
  }

  function renderTop5() {
    var evalRes = getEvaluation();
    var tbody = document.getElementById('tbody-top5-teams');
    tbody.innerHTML = '';

    evalRes.top5.forEach(function (team, idx) {
      var tr = document.createElement('tr');
      var refDone = team.reflections && team.reflections.portfolioReason && team.reflections.keyDecision;
      tr.innerHTML = `
        <td class="text-center font-mono"><span class="badge-rank badge-rank-${idx + 1}">Finalist #${idx + 1}</span></td>
        <td><strong>${escapeHtml(team.name)}</strong></td>
        <td class="text-right font-mono val-cyan" style="font-size: 15px;">${formatPoints(team.automaticScore)}</td>
        <td class="text-right font-mono">${formatPoints(team.financialReturn)}</td>
        <td class="text-right font-mono">${formatCurrency(team.cash)}</td>
        <td class="text-center">
          <span class="status-badge ${refDone ? 'live' : 'info'}">${refDone ? 'Submitted' : 'Pending'}</span>
        </td>
        <td class="text-center">
          <button class="btn btn-cyan btn-sm" onclick="app.presentTeamOnStage(${idx})">Select on Stage</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (evalRes.top5.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted);">No teams evaluated.</td></tr>`;
    }
  }

  function renderStageRound() {
    var evalRes = getEvaluation();
    var top5 = evalRes.top5;
    if (top5.length === 0) return;

    if (state.stageCurrentTeamIndex >= top5.length) state.stageCurrentTeamIndex = 0;
    var currentTeam = top5[state.stageCurrentTeamIndex];

    document.getElementById('stage-current-team-name').textContent = `${state.stageCurrentTeamIndex + 1}. ${currentTeam.name}`;

    var refContainer = document.getElementById('stage-reflections-container');
    var ref = currentTeam.reflections || {};
    refContainer.innerHTML = `
      <div class="reflection-prompt-block">
        <div class="reflection-prompt-title">1. Why We Built This Portfolio</div>
        <div class="reflection-prompt-text">${escapeHtml(ref.portfolioReason || 'Not yet entered by team.')}</div>
      </div>
      <div class="reflection-prompt-block">
        <div class="reflection-prompt-title">2. Our Most Important Decision</div>
        <div class="reflection-prompt-text">${escapeHtml(ref.keyDecision || 'Not yet entered by team.')}</div>
      </div>
      <div class="reflection-prompt-block">
        <div class="reflection-prompt-title">3. What We Would Change</div>
        <div class="reflection-prompt-text">${escapeHtml(ref.whatToChange || 'Not yet entered by team.')}</div>
      </div>
    `;

    updateTimerDisplay();
  }

  function renderJudgeScoring() {
    var evalRes = getEvaluation();
    var container = document.getElementById('judge-scoring-panels-container');
    container.innerHTML = '';

    evalRes.top5.forEach(function (team) {
      var teamJudges = state.judgeScores[team.id] || [];
      // Guarantee judges exist
      if (teamJudges.length === 0) {
        teamJudges = state.judgesList.map(function (jName) {
          return { judgeName: jName, clarity: 1, justification: 1, qaAnswer: 1 };
        });
        state.judgeScores[team.id] = teamJudges;
      }

      var card = document.createElement('div');
      card.className = 'judge-scoring-card';

      var judgesHtml = teamJudges.map(function (j, jIdx) {
        return `
          <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(j.judgeName)}</strong>
              <span class="font-mono val-gold" id="judge-total-${team.id}-${jIdx}">${(j.clarity + j.justification + j.qaAnswer)} / 3 pts</span>
            </div>
            <div class="judge-criteria-row">
              <span style="font-size: 12px; color: var(--text-secondary);">1. Clarity of Report</span>
              <div class="toggle-score-group">
                <button type="button" class="toggle-score-btn ${j.clarity === 0 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'clarity', 0)">0</button>
                <button type="button" class="toggle-score-btn ${j.clarity === 1 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'clarity', 1)">1</button>
              </div>
            </div>
            <div class="judge-criteria-row">
              <span style="font-size: 12px; color: var(--text-secondary);">2. Justification of Choices</span>
              <div class="toggle-score-group">
                <button type="button" class="toggle-score-btn ${j.justification === 0 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'justification', 0)">0</button>
                <button type="button" class="toggle-score-btn ${j.justification === 1 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'justification', 1)">1</button>
              </div>
            </div>
            <div class="judge-criteria-row" style="border-bottom: none;">
              <span style="font-size: 12px; color: var(--text-secondary);">3. Answer to Judge's Question</span>
              <div class="toggle-score-group">
                <button type="button" class="toggle-score-btn ${j.qaAnswer === 0 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'qaAnswer', 0)">0</button>
                <button type="button" class="toggle-score-btn ${j.qaAnswer === 1 ? 'active' : ''}" onclick="app.setJudgeScore('${team.id}', ${jIdx}, 'qaAnswer', 1)">1</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      var calcBonus = window.TLOSScoring.calculateJudgeBonus(team.id, true, teamJudges);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--accent-cyan);">${escapeHtml(team.name)}</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Automatic Score: ${formatPoints(team.automaticScore)}</span>
          </div>
          <div class="text-right">
            <span class="stat-label">Final Judge Bonus</span>
            <div class="font-mono val-gold" style="font-size: 20px;">+${calcBonus.judgeBonus} pts</div>
            <span style="font-size: 11px; color: var(--text-muted);">(Average: ${calcBonus.average.toFixed(2)})</span>
          </div>
        </div>
        <div>${judgesHtml}</div>
      `;
      container.appendChild(card);
    });
  }

  function renderFinalResults() {
    var evalRes = getEvaluation();
    var podium = document.getElementById('podium-cards-container');
    podium.innerHTML = '';

    var top3 = evalRes.leaderboard.slice(0, 3);
    var medals = ['🥇 1st Place Champion', '🥈 2nd Place Runner-Up', '🥉 3rd Place Third Place'];
    var colors = ['var(--accent-gold)', '#cbd5e1', '#d97706'];

    top3.forEach(function (team, idx) {
      var box = document.createElement('div');
      box.className = 'card';
      box.style.borderTop = '4px solid ' + colors[idx];
      box.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; color: ${colors[idx]}; text-transform: uppercase; margin-bottom: 6px;">
          ${medals[idx]}
        </div>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">${escapeHtml(team.name)}</h2>
        <div style="margin-bottom: 12px;">
          <div class="stat-label">Final Score (Max 103)</div>
          <div class="font-mono val-gold" style="font-size: 28px;">${formatPoints(team.finalScore)}</div>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
          <div>Auto Score: <span class="font-mono val-cyan">${formatPoints(team.automaticScore)}</span></div>
          <div>Judge Bonus: <span class="font-mono val-gold">+${team.judgeBonus}</span></div>
          <div>Final Net Worth: <span class="font-mono">${formatCurrency(team.finalNetWorth)}</span></div>
        </div>
      `;
      podium.appendChild(box);
    });

    var tbody = document.getElementById('tbody-final-results');
    tbody.innerHTML = '';
    evalRes.leaderboard.forEach(function (team, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center font-mono"><strong>${team.finalRank || idx + 1}</strong></td>
        <td><strong>${escapeHtml(team.name)}</strong></td>
        <td class="text-right font-mono">${formatCurrency(team.finalNetWorth)}</td>
        <td class="text-right font-mono">${formatPoints(team.automaticScore)}</td>
        <td class="text-right font-mono ${team.judgeBonus > 0 ? 'val-gold' : ''}">+${team.judgeBonus}</td>
        <td class="text-right font-mono val-gold" style="font-size: 15px;">${formatPoints(team.finalScore)}</td>
        <td>${team.tieBreakNotes ? '<span class="badge badge-bad">' + escapeHtml(team.tieBreakNotes) + '</span>' : 'Official'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderReports() {
    var select = document.getElementById('select-report-team');
    select.innerHTML = '';
    state.teams.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + ' (' + t.id + ')';
      if (t.id === state.currentReportTeamId) opt.selected = true;
      select.appendChild(opt);
    });

    if (!state.currentReportTeamId && state.teams.length > 0) {
      state.currentReportTeamId = state.teams[0].id;
    }

    var team = state.teams.find(function (t) { return t.id === state.currentReportTeamId; });
    if (!team) return;

    var evalRes = getEvaluation();
    var evaluatedTeam = evalRes.leaderboard.find(function (t) { return t.id === team.id; }) || {};
    var dqData = evalRes.auditData.dqResults[team.id] || { eventScores: [] };

    var canvas = document.getElementById('trade-report-print-canvas');
    var startingHoldings = team.startingHoldings || team.holdings || {};

    var holdingsRows = [];
    state.companies.forEach(function (c) {
      var qty = startingHoldings[c.id] || 0;
      if (qty > 0) {
        var val = qty * c.startingPrice;
        holdingsRows.push(`
          <tr>
            <td><strong>${c.ticker}</strong> - ${escapeHtml(c.name)}</td>
            <td class="text-right font-mono">${qty.toLocaleString()}</td>
            <td class="text-right font-mono">${formatCurrency(c.startingPrice)}</td>
            <td class="text-right font-mono">${formatCurrency(val)}</td>
          </tr>
        `);
      }
    });

    var eventRows = dqData.eventScores.map(function (es, idx) {
      return `
        <tr>
          <td><strong>Event ${idx + 1}: ${escapeHtml(es.eventName)}</strong></td>
          <td class="font-mono">${es.chosenOptionId || 'Default'}</td>
          <td class="text-right font-mono">${formatCurrency(es.chosenDelta)}</td>
          <td class="text-right font-mono">${formatCurrency(es.bestDelta)}</td>
          <td class="text-right font-mono">${formatCurrency(es.worstDelta)}</td>
          <td class="text-right font-mono val-gold">${formatPoints(es.score)} / 5</td>
        </tr>
      `;
    }).join('');

    var ref = team.reflections || {};

    canvas.innerHTML = `
      <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 24px; font-weight: 800; letter-spacing: 1px;">TLOS — THE MARKET SIMULATION</div>
          <div style="font-size: 13px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Official Team Trade & Decision Performance Report</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 18px; font-weight: 700;">${escapeHtml(team.name)}</div>
          <div style="font-size: 12px; color: #475569;">Team ID: ${team.id} | Final Rank: #${evaluatedTeam.finalRank || '-'}</div>
        </div>
      </div>

      <!-- Section: Phase 1 Starting Portfolio -->
      <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">1. Phase 1 Starting Portfolio</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px; text-align: left; border: 1px solid #cbd5e1;">Company / Asset</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Allocated Shares</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Phase 1 Price</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Starting Value</th>
          </tr>
        </thead>
        <tbody>
          ${holdingsRows.join('')}
          <tr style="font-weight: bold; background: #fafafa;">
            <td style="padding: 6px; border: 1px solid #cbd5e1;">Starting Cash Reserve</td>
            <td colspan="2" style="border: 1px solid #cbd5e1;"></td>
            <td style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;" class="font-mono">${formatCurrency(team.startingCash)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Section: Event-by-Event Decisions -->
      <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">2. Simulation Decisions (Events 1 to 6)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px; text-align: left; border: 1px solid #cbd5e1;">Event Scenario</th>
            <th style="padding: 6px; text-align: left; border: 1px solid #cbd5e1;">Selected Choice</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Chosen &Delta;NW</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Best &Delta;NW</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Worst &Delta;NW</th>
            <th style="padding: 6px; text-align: right; border: 1px solid #cbd5e1;">Score</th>
          </tr>
        </thead>
        <tbody>
          ${eventRows}
        </tbody>
      </table>

      <!-- Section: Totals & Evaluation Metrics -->
      <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">3. Final Official Evaluation Scores</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
        <tr style="background: #f8fafc;">
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Final Net Worth: <strong>${formatCurrency(evaluatedTeam.finalNetWorth)}</strong></td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Financial Return: <strong>${formatPoints(evaluatedTeam.financialReturn)} / 50</strong></td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Decision Quality: <strong>${formatPoints(evaluatedTeam.decisionQuality)} / 30</strong></td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Risk Management: <strong>${formatPoints(evaluatedTeam.riskManagement)} / 20</strong></td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Automatic Score: <strong>${formatPoints(evaluatedTeam.automaticScore)} / 100</strong></td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">Judge Bonus: <strong>+${evaluatedTeam.judgeBonus} / 3</strong></td>
        </tr>
        <tr style="background: #f1f5f9; font-weight: bold; font-size: 13px;">
          <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1;">Final Tournament Score (Max 103 pts):</td>
          <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; font-size: 15px;">${formatPoints(evaluatedTeam.finalScore)}</td>
        </tr>
      </table>

      <!-- Section: Written Reflections -->
      <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">4. Stage Round Written Reflections</h3>
      <div style="margin-bottom: 10px;">
        <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">1. Why we built this portfolio:</label>
        <textarea id="report-input-reason" class="form-control" style="background: #ffffff; color: #000; border: 1px solid #cbd5e1; font-size: 12px; min-height: 60px;">${escapeHtml(ref.portfolioReason || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">2. Our most important decision:</label>
        <textarea id="report-input-decision" class="form-control" style="background: #ffffff; color: #000; border: 1px solid #cbd5e1; font-size: 12px; min-height: 60px;">${escapeHtml(ref.keyDecision || '')}</textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">3. What we would change:</label>
        <textarea id="report-input-change" class="form-control" style="background: #ffffff; color: #000; border: 1px solid #cbd5e1; font-size: 12px; min-height: 60px;">${escapeHtml(ref.whatToChange || '')}</textarea>
      </div>
    `;
  }

  function renderBackup() {
    // Handled by static inputs & event listeners
  }

  // Projector Display Mode Rendering
  function renderProjectorDisplay() {
    var activeEv = state.events[state.activeEventIndex] || state.events[0];
    if (activeEv) {
      document.getElementById('proj-event-number-badge').textContent = 'EVENT ' + (activeEv.order || state.activeEventIndex + 1);
      document.getElementById('proj-event-bad-badge').innerHTML = activeEv.isBadEvent ? 
        '<span class="badge badge-bad">⚠️ Bad Event</span>' : '<span class="badge badge-normal">Standard Market Event</span>';
      document.getElementById('proj-event-title').textContent = activeEv.name;
      document.getElementById('proj-event-desc').textContent = activeEv.description;

      var optionsContainer = document.getElementById('proj-event-options-list');
      optionsContainer.innerHTML = activeEv.options.map(function (opt) {
        return `
          <div style="background: rgba(255,255,255,0.04); padding: 10px 14px; border-radius: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--accent-cyan); font-size: 14px;">
              <span>${escapeHtml(opt.name)}</span>
              <span class="font-mono">${opt.cost > 0 ? 'Cost: ' + formatCurrency(opt.cost) : 'No Fee'}</span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(opt.description || '')}</p>
          </div>
        `;
      }).join('');
    }

    // Market Ticker
    var tickerGrid = document.getElementById('proj-market-ticker-grid');
    tickerGrid.innerHTML = state.companies.map(function (c) {
      return `
        <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${c.ticker}</div>
          <div class="font-mono val-cyan" style="font-size: 16px;">${formatCurrency(c.currentPrice)}</div>
        </div>
      `;
    }).join('');

    // Standings
    var evalRes = getEvaluation();
    var tbody = document.getElementById('proj-tbody-standings');
    tbody.innerHTML = '';
    evalRes.leaderboard.forEach(function (team, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center font-mono"><strong>${team.finalRank || idx + 1}</strong></td>
        <td><strong>${escapeHtml(team.name)}</strong></td>
        <td class="text-right font-mono">${formatCurrency(team.finalNetWorth)}</td>
        <td class="text-right font-mono val-gold">${state.isFinalized ? formatPoints(team.finalScore) : '---'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAll() {
    renderHeaderStatus();
    navigateTo(state.activeView);
  }

  // -------------------------------------------------------------
  // TIMER FUNCTIONS
  // -------------------------------------------------------------

  function updateTimerDisplay() {
    var min = Math.floor(state.timer.remainingSeconds / 60);
    var sec = state.timer.remainingSeconds % 60;
    var str = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;

    var clockEl = document.getElementById('stage-timer-clock');
    if (clockEl) {
      clockEl.textContent = str;
      clockEl.className = 'stage-timer-display';
      if (state.timer.remainingSeconds <= 15) {
        clockEl.classList.add('danger');
      } else if (state.timer.remainingSeconds <= 60) {
        clockEl.classList.add('warning');
      }
    }
  }

  function startTimer() {
    if (state.timer.isRunning) return;
    state.timer.isRunning = true;
    document.getElementById('btn-timer-start').style.display = 'none';
    document.getElementById('btn-timer-pause').style.display = 'inline-flex';

    state.timer.intervalId = setInterval(function () {
      if (state.timer.remainingSeconds > 0) {
        state.timer.remainingSeconds--;
        updateTimerDisplay();
      } else {
        pauseTimer();
        playChime();
        showToast('⏰ Time is up for current stage!');
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!state.timer.isRunning) return;
    state.timer.isRunning = false;
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
    document.getElementById('btn-timer-start').style.display = 'inline-flex';
    document.getElementById('btn-timer-pause').style.display = 'none';
  }

  function resetTimer(newSeconds) {
    pauseTimer();
    if (typeof newSeconds === 'number') {
      state.timer.totalSeconds = newSeconds;
    }
    state.timer.remainingSeconds = state.timer.totalSeconds;
    updateTimerDisplay();
  }

  // -------------------------------------------------------------
  // ACTIONS & LOGIC
  // -------------------------------------------------------------

  function submitTeamChoice(eventId, teamId) {
    var sel = document.getElementById('select-opt-' + teamId);
    if (!sel) return;
    var optId = sel.value;

    var ev = state.events.find(function (e) { return e.id === eventId; });
    var opt = ev ? ev.options.find(function (o) { return o.id === optId; }) : null;
    var team = state.teams.find(function (t) { return t.id === teamId; });

    if (!ev || !opt || !team) return;

    if (!state.eventLogs[eventId]) {
      state.eventLogs[eventId] = {};
    }

    var preHoldings = JSON.parse(JSON.stringify(team.holdings || team.startingHoldings || {}));
    var preCash = team.cash;
    var prePrices = {};
    state.companies.forEach(function (c) { prePrices[c.id] = c.currentPrice; });

    var deltaNW = window.TLOSScoring.calculateOptionDeltaNetWorth(opt, preHoldings, preCash, prePrices);

    state.eventLogs[eventId][teamId] = {
      chosenOptionId: optId,
      preHoldings: preHoldings,
      preCash: preCash,
      prePrices: prePrices,
      deltaNW: deltaNW,
      cost: opt.cost
    };

    saveState();
    renderSimControl();
    showToast('Decision saved for ' + team.name);
  }

  function previewTeamOptionChoice(eventId, teamId, optId) {
    var ev = state.events.find(function (e) { return e.id === eventId; });
    var opt = ev ? ev.options.find(function (o) { return o.id === optId; }) : null;
    var team = state.teams.find(function (t) { return t.id === teamId; });
    if (!opt || !team) return;

    var preHoldings = team.holdings || team.startingHoldings || {};
    var preCash = team.cash;
    var prePrices = {};
    state.companies.forEach(function (c) { prePrices[c.id] = c.currentPrice; });

    var delta = window.TLOSScoring.calculateOptionDeltaNetWorth(opt, preHoldings, preCash, prePrices);

    var costEl = document.getElementById('cost-' + teamId);
    var deltaEl = document.getElementById('delta-' + teamId);

    if (costEl) costEl.textContent = formatCurrency(opt.cost);
    if (deltaEl) {
      deltaEl.textContent = (delta >= 0 ? '+' : '') + formatCurrency(delta);
      deltaEl.className = 'text-right font-mono ' + (delta >= 0 ? 'val-positive' : 'val-negative');
    }
  }

  function lockCurrentEvent() {
    var activeEv = state.events[state.activeEventIndex];
    if (!activeEv) return;

    if (confirm('Lock Event ' + (activeEv.order || state.activeEventIndex + 1) + '? This locks participant submissions.')) {
      activeEv.status = 'completed';
      saveState();
      renderSimControl();
      showToast('Event ' + (state.activeEventIndex + 1) + ' locked.');
    }
  }

  function reopenCurrentEvent() {
    var activeEv = state.events[state.activeEventIndex];
    if (!activeEv) return;

    if (confirm('Admin confirmation: Reopen Event ' + (activeEv.order || state.activeEventIndex + 1) + ' for modifications?')) {
      activeEv.status = 'active';
      saveState();
      renderSimControl();
      showToast('Event ' + (state.activeEventIndex + 1) + ' reopened.');
    }
  }

  function toggleFinalize() {
    var nextState = !state.isFinalized;
    var msg = nextState ? 
      'Finalize simulation? This calculates official standings, Top 5 qualifiers, and reveals all metric score breakdowns.' : 
      'Unfinalize simulation? Standings will revert to participant-safe masked mode.';

    if (confirm(msg)) {
      state.isFinalized = nextState;
      saveState();
      renderAll();
      showToast(nextState ? 'Simulation results finalized!' : 'Simulation unfinalized.');
    }
  }

  function setJudgeScore(teamId, judgeIndex, field, value) {
    if (!state.judgeScores[teamId]) return;
    if (!state.judgeScores[teamId][judgeIndex]) return;

    state.judgeScores[teamId][judgeIndex][field] = value;
    saveState();
    renderJudgeScoring();
  }

  function saveReflections() {
    var team = state.teams.find(function (t) { return t.id === state.currentReportTeamId; });
    if (!team) return;

    var r1 = document.getElementById('report-input-reason').value;
    var r2 = document.getElementById('report-input-decision').value;
    var r3 = document.getElementById('report-input-change').value;

    if (!team.reflections) team.reflections = {};
    team.reflections.portfolioReason = r1;
    team.reflections.keyDecision = r2;
    team.reflections.whatToChange = r3;

    saveState();
    showToast('Reflections saved for ' + team.name);
  }

  function exportReportPDF() {
    var element = document.getElementById('trade-report-print-canvas');
    if (window.html2pdf) {
      var opt = {
        margin: 10,
        filename: 'TLOS_Trade_Report_' + (state.currentReportTeamId || 'Team') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  }

  function exportAllTop5PDF() {
    var evalRes = getEvaluation();
    var top5 = evalRes.top5;
    if (top5.length === 0) {
      alert('No Top 5 teams to export.');
      return;
    }

    // Switch to each and print or trigger browser print
    window.print();
  }

  // Browser Tests Runner
  function runBrowserTests() {
    var container = document.getElementById('tests-results-container');
    container.innerHTML = '<div style="color: var(--accent-cyan);">Running engine tests...</div>';

    var scoring = window.TLOSScoring;
    var tests = [
      {
        name: '1. Highest Financial Return = 50 pts',
        run: function () {
          var res = scoring.calculateFinancialReturn([{ id: 'T1', cash: 100 }, { id: 'T2', cash: 50 }], []);
          if (res['T1'].points !== 50) throw new Error('Points was ' + res['T1'].points);
        }
      },
      {
        name: '2. Lowest Financial Return = 0 pts',
        run: function () {
          var res = scoring.calculateFinancialReturn([{ id: 'T1', cash: 100 }, { id: 'T2', cash: 50 }], []);
          if (res['T2'].points !== 0) throw new Error('Points was ' + res['T2'].points);
        }
      },
      {
        name: '3. Correct average ranks for ties',
        run: function () {
          var res = scoring.calculateFinancialReturn([{ id: 'T1', cash: 100 }, { id: 'T2', cash: 100 }, { id: 'T3', cash: 20 }], []);
          if (res['T1'].averageRank !== 1.5) throw new Error('Rank was ' + res['T1'].averageRank);
          var expected = 50 * (3 - 1.5) / 2;
          if (Math.abs(res['T1'].points - expected) > 1e-9) throw new Error('Points did not match expected formula');
        }
      },
      {
        name: '4. Six best-option decisions = 30 Decision Quality pts',
        run: function () {
          var evs = [], logs = {};
          for (var i = 1; i <= 6; i++) {
            evs.push({ id: 'E' + i, affectedCompanies: ['X'], options: [{ id: 'b', cost: 0, priceChanges: { 'X': 10 } }, { id: 'w', cost: 0, priceChanges: { 'X': -10 } }] });
            logs['E' + i] = { 'T1': { chosenOptionId: 'b', preHoldings: { 'X': 10 }, prePrices: { 'X': 50 } } };
          }
          var r = scoring.calculateDecisionQualityForTeam({ id: 'T1' }, evs, logs);
          if (r.totalScore !== 30) throw new Error('DQ was ' + r.totalScore);
        }
      },
      {
        name: '5. Best equals worst = 2.5 pts for that event',
        run: function () {
          var evs = [{ id: 'E1', affectedCompanies: ['X'], options: [{ id: '1', cost: 0, priceChanges: {} }, { id: '2', cost: 0, priceChanges: {} }] }];
          var logs = { 'E1': { 'T1': { chosenOptionId: '1', preHoldings: { 'X': 10 }, prePrices: { 'X': 50 } } } };
          var r = scoring.calculateDecisionQualityForTeam({ id: 'T1' }, evs, logs);
          if (r.eventScores[0].score !== 2.5) throw new Error('Score was ' + r.eventScores[0].score);
        }
      },
      {
        name: '6. No affected shares owned = 2.5 pts',
        run: function () {
          var evs = [{ id: 'E1', affectedCompanies: ['OIL'], options: [{ id: '1', cost: 0, priceChanges: { 'OIL': 10 } }, { id: '2', cost: 0, priceChanges: { 'OIL': -10 } }] }];
          var logs = { 'E1': { 'T1': { chosenOptionId: '1', preHoldings: { 'TECH': 10, 'OIL': 0 }, prePrices: { 'OIL': 50 } } } };
          var r = scoring.calculateDecisionQualityForTeam({ id: 'T1' }, evs, logs);
          if (r.eventScores[0].score !== 2.5) throw new Error('Score was ' + r.eventScores[0].score);
        }
      },
      {
        name: '7. Correct diversification values (3->4, 4->6, 5->8, 6->10, <3->0)',
        run: function () {
          var t3 = [{ id: 'T', startingHoldings: { 'A': 1, 'B': 1, 'C': 1 } }];
          var t6 = [{ id: 'T', startingHoldings: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1 } }];
          var r3 = scoring.calculateRiskManagement(t3, [], {});
          var r6 = scoring.calculateRiskManagement(t6, [], {});
          if (r3['T'].diversificationScore !== 4) throw new Error('3 cos was ' + r3['T'].diversificationScore);
          if (r6['T'].diversificationScore !== 10) throw new Error('6 cos was ' + r6['T'].diversificationScore);
        }
      },
      {
        name: '8. Largest Bad Event loss = 0 Downside Control pts',
        run: function () {
          var badEv = [{ id: 'B1', isBadEvent: true }];
          var teams = [{ id: 'W', startingHoldings: { 'A': 1 } }, { id: 'S', startingHoldings: { 'A': 1 } }];
          var logs = { 'B1': { 'W': { deltaNW: -1000 }, 'S': { deltaNW: 0 } } };
          var r = scoring.calculateRiskManagement(teams, badEv, logs);
          if (r['W'].downsideControlScore !== 0) throw new Error('Worst loss pts was ' + r['W'].downsideControlScore);
        }
      },
      {
        name: '9. Non-losing team = 10 Downside Control pts',
        run: function () {
          var badEv = [{ id: 'B1', isBadEvent: true }];
          var teams = [{ id: 'W', startingHoldings: { 'A': 1 } }, { id: 'S', startingHoldings: { 'A': 1 } }];
          var logs = { 'B1': { 'W': { deltaNW: -1000 }, 'S': { deltaNW: 100 } } };
          var r = scoring.calculateRiskManagement(teams, badEv, logs);
          if (r['S'].downsideControlScore !== 10) throw new Error('Safe team pts was ' + r['S'].downsideControlScore);
        }
      },
      {
        name: '10. Only top five teams receive judge bonuses',
        run: function () {
          var teams = [];
          for (var i = 1; i <= 7; i++) teams.push({ id: 'T' + i, cash: 10000 * (10 - i) });
          var jScores = {};
          for (var i = 1; i <= 7; i++) jScores['T' + i] = [{ clarity: 1, justification: 1, qaAnswer: 1 }];
          var res = scoring.evaluateSimulation(teams, [], [], {}, jScores);
          var sixth = res.leaderboard[5];
          if (sixth.judgeBonus !== 0) throw new Error('6th place received ' + sixth.judgeBonus);
        }
      },
      {
        name: '11. Fifth-place tie-break uses Financial Return then Cash',
        run: function () {
          var tA = { id: 'TA', automaticScore: 60, financialReturn: 25, cash: 1000 };
          var tB = { id: 'TB', automaticScore: 60, financialReturn: 20, cash: 2000 };
          var list = [tA, tB].sort(function (a, b) {
            if (b.automaticScore !== a.automaticScore) return b.automaticScore - a.automaticScore;
            return b.financialReturn - a.financialReturn;
          });
          if (list[0].id !== 'TA') throw new Error('Tie breaker failed');
        }
      },
      {
        name: '12. Final Score = Automatic Score + Judge Bonus',
        run: function () {
          var teams = [{ id: 'T1', cash: 1000, startingHoldings: { 'A': 1, 'B': 1, 'C': 1 } }];
          var jScores = { 'T1': [{ clarity: 1, justification: 1, qaAnswer: 1 }] };
          var res = scoring.evaluateSimulation(teams, [], [], {}, jScores);
          var t = res.leaderboard[0];
          if (t.finalScore !== t.automaticScore + t.judgeBonus) throw new Error('Sum mismatch');
        }
      },
      {
        name: '13. Edge case: Single team (N=1) safe handling',
        run: function () {
          var res = scoring.calculateFinancialReturn([{ id: 'Solo', cash: 1000 }], []);
          if (res['Solo'].points !== 50) throw new Error('N=1 points was ' + res['Solo'].points);
        }
      },
      {
        name: '14. Edge case: No bad event losses in room',
        run: function () {
          var badEv = [{ id: 'B1', isBadEvent: true }];
          var teams = [{ id: 'T1', startingHoldings: { 'A': 1 } }];
          var logs = { 'B1': { 'T1': { deltaNW: 500 } } };
          var r = scoring.calculateRiskManagement(teams, badEv, logs);
          if (r['T1'].downsideControlScore !== 10) throw new Error('Score was ' + r['T1'].downsideControlScore);
        }
      }
    ];

    setTimeout(function () {
      container.innerHTML = '';
      var passed = 0;
      tests.forEach(function (t) {
        var row = document.createElement('div');
        row.style.padding = '8px 12px';
        row.style.borderRadius = '4px';
        row.style.background = 'var(--bg-surface)';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        try {
          t.run();
          passed++;
          row.innerHTML = `<span style="font-size: 13px;">${escapeHtml(t.name)}</span> <span class="badge badge-normal" style="background: var(--market-green-bg); color: var(--market-green);">✓ PASSED</span>`;
        } catch (e) {
          row.innerHTML = `<span style="font-size: 13px;">${escapeHtml(t.name)}</span> <span class="badge badge-bad">FAILED: ${escapeHtml(e.message)}</span>`;
        }
        container.appendChild(row);
      });

      var summary = document.createElement('div');
      summary.style.marginTop = '12px';
      summary.style.fontWeight = 'bold';
      summary.style.color = passed === tests.length ? 'var(--market-green)' : 'var(--market-red)';
      summary.textContent = `Summary: ${passed} / ${tests.length} tests passed successfully.`;
      container.appendChild(summary);
    }, 100);
  }

  // Backup & Restore
  function downloadJSONBackup() {
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    var dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', 'TLOS_Simulation_Backup_' + new Date().toISOString().slice(0, 10) + '.json');
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    showToast('Simulation backup downloaded!');
  }

  function restoreJSONBackup(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var parsed = JSON.parse(e.target.result);
        if (!parsed.teams || !parsed.companies || !parsed.events) {
          alert('Invalid TLOS backup file: Missing required schema arrays.');
          return;
        }
        if (confirm('Restore backup with ' + parsed.teams.length + ' teams? This will replace active simulation state.')) {
          state = parsed;
          saveState();
          renderAll();
          showToast('Simulation state restored successfully!');
        }
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function wipeAndResetSimulation() {
    if (confirm('CRITICAL ACTION: Wipe all tournament data and reset to a clean blank state?')) {
      state = {
        teams: [],
        companies: [],
        events: JSON.parse(JSON.stringify(window.TLOSDefaultData.DEFAULT_EVENTS)),
        eventLogs: {},
        judgeScores: {},
        judgesList: ['Judge 1', 'Judge 2', 'Judge 3'],
        activeEventIndex: 0,
        isFinalized: false,
        activeView: 'overview',
        stageCurrentTeamIndex: 0,
        currentReportTeamId: null,
        currentAuditTeamId: null,
        timer: { totalSeconds: 300, remainingSeconds: 300, intervalId: null, isRunning: false }
      };
      saveState();
      renderAll();
      showToast('Simulation data cleared.');
    }
  }

  // Helper: HTML escaping
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // CSV Export helpers
  function exportTeamsCSV() {
    var headers = ['TeamId', 'TeamName', 'StartingCash', 'CurrentCash'];
    state.companies.forEach(function (c) { headers.push(c.ticker); });

    var rows = state.teams.map(function (t) {
      var r = [t.id, '"' + (t.name || '').replace(/"/g, '""') + '"', t.startingCash, t.cash];
      var h = t.startingHoldings || t.holdings || {};
      state.companies.forEach(function (c) { r.push(h[c.id] || 0); });
      return r.join(',');
    });

    var csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), rows.join('\n')].join('\n'));
    var dl = document.createElement('a');
    dl.setAttribute('href', csvContent);
    dl.setAttribute('download', 'TLOS_Teams.csv');
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  }

  function exportLeaderboardCSV() {
    var evalRes = getEvaluation();
    var headers = ['Rank', 'TeamName', 'FinalNetWorth', 'FinancialReturn', 'DecisionQuality', 'RiskManagement', 'AutomaticScore', 'JudgeBonus', 'FinalScore'];
    var rows = evalRes.leaderboard.map(function (t) {
      return [
        t.finalRank,
        '"' + (t.name || '').replace(/"/g, '""') + '"',
        t.finalNetWorth.toFixed(2),
        t.financialReturn.toFixed(2),
        t.decisionQuality.toFixed(2),
        t.riskManagement.toFixed(2),
        t.automaticScore.toFixed(2),
        t.judgeBonus,
        t.finalScore.toFixed(2)
      ].join(',');
    });

    var csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), rows.join('\n')].join('\n'));
    var dl = document.createElement('a');
    dl.setAttribute('href', csvContent);
    dl.setAttribute('download', 'TLOS_Official_Leaderboard.csv');
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  }

  // -------------------------------------------------------------
  // INITIALIZATION & EVENT LISTENERS
  // -------------------------------------------------------------

  function initApp() {
    // Attempt to load from storage or default to demo data
    if (!loadState() || state.teams.length === 0) {
      loadDemoData(true);
    }

    // Top Navigation Tabs
    var tabBtns = document.querySelectorAll('.nav-tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = this.getAttribute('data-view');
        navigateTo(view);
      });
    });

    // Header buttons
    document.getElementById('btn-load-demo').addEventListener('click', function () {
      loadDemoData(false);
    });

    document.getElementById('btn-run-tests').addEventListener('click', function () {
      openModal('modal-tests');
      runBrowserTests();
    });

    document.getElementById('btn-projector-mode').addEventListener('click', function () {
      document.getElementById('projector-overlay').classList.add('active');
      renderProjectorDisplay();
    });

    document.getElementById('btn-exit-projector').addEventListener('click', function () {
      document.getElementById('projector-overlay').classList.remove('active');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.getElementById('projector-overlay').classList.remove('active');
      }
    });

    // Projector Clock
    setInterval(function () {
      var now = new Date();
      var str = now.toTimeString().split(' ')[0];
      var el = document.getElementById('projector-live-clock');
      if (el) el.textContent = str;
    }, 1000);

    // Overview buttons
    var qFinalize = document.getElementById('btn-quick-finalize');
    if (qFinalize) qFinalize.addEventListener('click', toggleFinalize);

    // Leaderboard finalize toggle
    var lFinalize = document.getElementById('btn-toggle-finalize');
    if (lFinalize) lFinalize.addEventListener('click', toggleFinalize);

    document.getElementById('btn-export-leaderboard-csv').addEventListener('click', exportLeaderboardCSV);
    document.getElementById('btn-export-teams-csv').addEventListener('click', exportTeamsCSV);

    // Sim control buttons
    document.getElementById('btn-lock-event').addEventListener('click', lockCurrentEvent);
    document.getElementById('btn-reopen-event').addEventListener('click', reopenCurrentEvent);

    // Stage timer buttons
    document.getElementById('btn-timer-start').addEventListener('click', startTimer);
    document.getElementById('btn-timer-pause').addEventListener('click', pauseTimer);
    document.getElementById('btn-timer-reset').addEventListener('click', function () { resetTimer(); });
    document.getElementById('btn-timer-add30').addEventListener('click', function () {
      state.timer.remainingSeconds += 30;
      updateTimerDisplay();
    });

    var stageBtns = document.querySelectorAll('.stage-mode-btn');
    stageBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        stageBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        var s = parseInt(this.getAttribute('data-seconds'), 10);
        document.getElementById('stage-timer-mode-title').textContent = this.textContent;
        resetTimer(s);
      });
    });

    document.getElementById('btn-prev-stage-team').addEventListener('click', function () {
      if (state.stageCurrentTeamIndex > 0) {
        state.stageCurrentTeamIndex--;
        renderStageRound();
      }
    });
    document.getElementById('btn-next-stage-team').addEventListener('click', function () {
      var evalRes = getEvaluation();
      if (state.stageCurrentTeamIndex < evalRes.top5.length - 1) {
        state.stageCurrentTeamIndex++;
        renderStageRound();
      }
    });

    // Score audit selector
    document.getElementById('select-audit-team').addEventListener('change', function () {
      state.currentAuditTeamId = this.value;
      renderScoreAudit();
    });

    // Reports selector
    document.getElementById('select-report-team').addEventListener('change', function () {
      state.currentReportTeamId = this.value;
      renderReports();
    });
    document.getElementById('btn-save-reflections').addEventListener('click', saveReflections);
    document.getElementById('btn-export-pdf').addEventListener('click', exportReportPDF);
    document.getElementById('btn-export-all-pdf').addEventListener('click', exportAllTop5PDF);
    document.getElementById('btn-print-report').addEventListener('click', function () { window.print(); });

    // Backup actions
    document.getElementById('btn-download-json-backup').addEventListener('click', downloadJSONBackup);
    document.getElementById('btn-restore-json-action').addEventListener('click', function () {
      var fileInput = document.getElementById('input-restore-json');
      if (fileInput.files.length > 0) {
        restoreJSONBackup(fileInput.files[0]);
      } else {
        alert('Please choose a JSON backup file first.');
      }
    });
    document.getElementById('btn-reset-simulation').addEventListener('click', wipeAndResetSimulation);

    // Team Add/Edit Modal
    document.getElementById('btn-add-team').addEventListener('click', function () {
      app.openAddTeamModal();
    });
    document.getElementById('btn-save-team').addEventListener('click', app.saveTeamFromModal);

    // CSV Import
    document.getElementById('btn-import-csv').addEventListener('click', function () {
      openModal('modal-csv');
    });
    document.getElementById('btn-download-csv-template').addEventListener('click', function () {
      var tmpl = 'TeamName,StartingCash,TECH,ENER,PHAR,FIN,AERO,CONS\nSample Alpha,35000,100,50,0,80,0,120';
      var dl = document.createElement('a');
      dl.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(tmpl));
      dl.setAttribute('download', 'TLOS_Teams_Template.csv');
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
    });
    document.getElementById('btn-process-csv-import').addEventListener('click', app.processCSVImport);

    // Company Modal
    document.getElementById('btn-add-company').addEventListener('click', function () {
      app.openAddCompanyModal();
    });
    document.getElementById('btn-save-company').addEventListener('click', app.saveCompanyFromModal);

    // Event Modal
    document.getElementById('btn-save-event').addEventListener('click', app.saveEventFromModal);
    document.getElementById('btn-reset-demo-events').addEventListener('click', function () {
      if (confirm('Reset all 6 events to official DEMO scenarios?')) {
        state.events = JSON.parse(JSON.stringify(window.TLOSDefaultData.DEFAULT_EVENTS));
        saveState();
        renderEvents();
        showToast('Events reset to demo scenarios.');
      }
    });

    // Judge score save
    document.getElementById('btn-save-judge-scores').addEventListener('click', function () {
      saveState();
      showToast('Judge scores saved successfully!');
    });
    document.getElementById('btn-add-judge').addEventListener('click', function () {
      var jName = prompt('Enter New Judge Name:', 'Judge ' + (state.judgesList.length + 1));
      if (jName && jName.trim()) {
        state.judgesList.push(jName.trim());
        // Add judge to all teams
        for (var tId in state.judgeScores) {
          state.judgeScores[tId].push({ judgeName: jName.trim(), clarity: 1, justification: 1, qaAnswer: 1 });
        }
        saveState();
        renderJudgeScoring();
      }
    });

    // Initial render
    renderAll();
  }

  // -------------------------------------------------------------
  // EXPOSED APPLICATION CONTROLLER (window.app)
  // -------------------------------------------------------------

  window.app = {
    navigateTo: navigateTo,
    openModal: openModal,
    closeModal: closeModal,
    runBrowserTests: runBrowserTests,
    submitTeamChoice: submitTeamChoice,
    previewTeamOptionChoice: previewTeamOptionChoice,
    setJudgeScore: setJudgeScore,

    presentTeamOnStage: function (idx) {
      state.stageCurrentTeamIndex = idx;
      navigateTo('stage-round');
    },

    openAddTeamModal: function () {
      document.getElementById('modal-team-title').textContent = 'Add New Team';
      document.getElementById('input-team-id').value = '';
      document.getElementById('input-team-name').value = '';
      document.getElementById('input-team-cash').value = '35000';

      var holdingsGrid = document.getElementById('team-modal-holdings-grid');
      holdingsGrid.innerHTML = state.companies.map(function (c) {
        return `
          <div>
            <label class="form-label">${c.ticker} Shares</label>
            <input type="number" class="form-control" id="modal-holding-${c.id}" value="0" min="0">
          </div>
        `;
      }).join('');

      openModal('modal-team');
    },

    openEditTeamModal: function (teamId) {
      var team = state.teams.find(function (t) { return t.id === teamId; });
      if (!team) return;

      document.getElementById('modal-team-title').textContent = 'Edit Team: ' + team.name;
      document.getElementById('input-team-id').value = team.id;
      document.getElementById('input-team-name').value = team.name;
      document.getElementById('input-team-cash').value = team.startingCash;

      var holdings = team.startingHoldings || team.holdings || {};
      var holdingsGrid = document.getElementById('team-modal-holdings-grid');
      holdingsGrid.innerHTML = state.companies.map(function (c) {
        var q = holdings[c.id] || 0;
        return `
          <div>
            <label class="form-label">${c.ticker} Shares</label>
            <input type="number" class="form-control" id="modal-holding-${c.id}" value="${q}" min="0">
          </div>
        `;
      }).join('');

      openModal('modal-team');
    },

    saveTeamFromModal: function () {
      var tId = document.getElementById('input-team-id').value;
      var name = document.getElementById('input-team-name').value.trim();
      var cash = parseFloat(document.getElementById('input-team-cash').value) || 0;

      if (!name) {
        alert('Please enter a team name.');
        return;
      }

      var holdings = {};
      state.companies.forEach(function (c) {
        var val = parseInt(document.getElementById('modal-holding-' + c.id).value, 10) || 0;
        holdings[c.id] = Math.max(0, val);
      });

      if (tId) {
        var team = state.teams.find(function (t) { return t.id === tId; });
        if (team) {
          team.name = name;
          team.startingCash = cash;
          team.cash = cash;
          team.startingHoldings = holdings;
          team.holdings = holdings;
        }
      } else {
        var newId = 'TEAM_' + (state.teams.length + 1 < 10 ? '0' : '') + (state.teams.length + 1);
        state.teams.push({
          id: newId,
          name: name,
          startingCash: cash,
          cash: cash,
          startingHoldings: holdings,
          holdings: holdings,
          reflections: { portfolioReason: '', keyDecision: '', whatToChange: '' }
        });
      }

      saveState();
      closeModal('modal-team');
      renderTeams();
      showToast('Team saved successfully.');
    },

    deleteTeam: function (teamId) {
      var team = state.teams.find(function (t) { return t.id === teamId; });
      if (!team) return;
      if (confirm('Delete team "' + team.name + '"?')) {
        state.teams = state.teams.filter(function (t) { return t.id !== teamId; });
        saveState();
        renderTeams();
        showToast('Team removed.');
      }
    },

    processCSVImport: function () {
      var raw = document.getElementById('csv-paste-area').value.trim();
      if (!raw) {
        alert('Please paste CSV text or select a file.');
        return;
      }

      var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
      if (lines.length < 2) {
        alert('CSV must contain a header line and at least one team record.');
        return;
      }

      var headers = lines[0].split(',').map(function (h) { return h.trim().toUpperCase(); });
      var importedCount = 0;

      for (var i = 1; i < lines.length; i++) {
        var parts = lines[i].split(',').map(function (p) { return p.trim(); });
        var teamName = parts[0];
        var startingCash = parseFloat(parts[1]) || 35000;
        var holdings = {};

        for (var j = 2; j < parts.length; j++) {
          var ticker = headers[j];
          var qty = parseInt(parts[j], 10) || 0;
          holdings[ticker] = qty;
        }

        var newId = 'TEAM_' + (state.teams.length + 1 < 10 ? '0' : '') + (state.teams.length + 1);
        state.teams.push({
          id: newId,
          name: teamName,
          startingCash: startingCash,
          cash: startingCash,
          startingHoldings: holdings,
          holdings: holdings,
          reflections: { portfolioReason: '', keyDecision: '', whatToChange: '' }
        });
        importedCount++;
      }

      saveState();
      closeModal('modal-csv');
      renderTeams();
      showToast('Successfully imported ' + importedCount + ' teams.');
    },

    openAddCompanyModal: function () {
      document.getElementById('modal-company-title').textContent = 'Add New Company';
      document.getElementById('input-company-id').value = '';
      document.getElementById('input-company-ticker').value = '';
      document.getElementById('input-company-name').value = '';
      document.getElementById('input-company-sector').value = 'Technology';
      document.getElementById('input-company-start-price').value = '100';
      document.getElementById('input-company-curr-price').value = '100';
      document.getElementById('input-company-frozen-price').value = '100';
      openModal('modal-company');
    },

    openEditCompanyModal: function (compId) {
      var comp = state.companies.find(function (c) { return c.id === compId; });
      if (!comp) return;

      document.getElementById('modal-company-title').textContent = 'Edit Company: ' + comp.name;
      document.getElementById('input-company-id').value = comp.id;
      document.getElementById('input-company-ticker').value = comp.ticker;
      document.getElementById('input-company-name').value = comp.name;
      document.getElementById('input-company-sector').value = comp.sector || '';
      document.getElementById('input-company-start-price').value = comp.startingPrice;
      document.getElementById('input-company-curr-price').value = comp.currentPrice;
      document.getElementById('input-company-frozen-price').value = comp.frozenFinalPrice;
      openModal('modal-company');
    },

    saveCompanyFromModal: function () {
      var cId = document.getElementById('input-company-id').value;
      var ticker = document.getElementById('input-company-ticker').value.trim().toUpperCase();
      var name = document.getElementById('input-company-name').value.trim();
      var sector = document.getElementById('input-company-sector').value.trim();
      var startP = parseFloat(document.getElementById('input-company-start-price').value) || 100;
      var currP = parseFloat(document.getElementById('input-company-curr-price').value) || startP;
      var frozenP = parseFloat(document.getElementById('input-company-frozen-price').value) || currP;

      if (!ticker || !name) {
        alert('Ticker and Company Name are required.');
        return;
      }

      if (cId) {
        var comp = state.companies.find(function (c) { return c.id === cId; });
        if (comp) {
          comp.ticker = ticker;
          comp.name = name;
          comp.sector = sector;
          comp.startingPrice = startP;
          comp.currentPrice = currP;
          comp.frozenFinalPrice = frozenP;
        }
      } else {
        state.companies.push({
          id: ticker,
          ticker: ticker,
          name: name,
          sector: sector,
          startingPrice: startP,
          currentPrice: currP,
          frozenFinalPrice: frozenP,
          description: ''
        });
      }

      saveState();
      closeModal('modal-company');
      renderCompanies();
      showToast('Company saved successfully.');
    },

    openEditEventModal: function (eventId) {
      var ev = state.events.find(function (e) { return e.id === eventId; });
      if (!ev) return;

      document.getElementById('modal-event-title').textContent = 'Configure: ' + ev.name;
      document.getElementById('input-event-id').value = ev.id;
      document.getElementById('input-event-name').value = ev.name;
      document.getElementById('input-event-is-bad').value = ev.isBadEvent ? 'true' : 'false';
      document.getElementById('input-event-desc').value = ev.description || '';

      // Affected tickers checkboxes
      var affContainer = document.getElementById('event-affected-tickers-checkboxes');
      affContainer.innerHTML = state.companies.map(function (c) {
        var checked = (ev.affectedCompanies && ev.affectedCompanies.indexOf(c.id) !== -1) ? 'checked' : '';
        return `
          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px;">
            <input type="checkbox" name="ev-aff-co" value="${c.id}" ${checked}> ${c.ticker}
          </label>
        `;
      }).join('');

      // Options editor
      var optContainer = document.getElementById('event-options-editor-container');
      optContainer.innerHTML = ev.options.map(function (opt, oIdx) {
        var priceInputs = state.companies.map(function (c) {
          var val = (opt.priceChanges && typeof opt.priceChanges[c.id] === 'number') ? opt.priceChanges[c.id] : 0;
          return `
            <div style="flex: 1; min-width: 90px;">
              <label style="font-size: 10px; color: var(--text-muted);">${c.ticker} &Delta;P ($)</label>
              <input type="number" step="0.5" class="form-control" id="opt-price-${oIdx}-${c.id}" value="${val}">
            </div>
          `;
        }).join('');

        return `
          <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div class="form-row" style="margin-bottom: 8px;">
              <div style="flex: 2;">
                <label class="form-label">Option Name</label>
                <input type="text" class="form-control" id="opt-name-${oIdx}" value="${escapeHtml(opt.name)}">
              </div>
              <div style="flex: 1;">
                <label class="form-label">Cost / Fee ($)</label>
                <input type="number" class="form-control" id="opt-cost-${oIdx}" value="${opt.cost || 0}">
              </div>
            </div>
            <div style="margin-bottom: 8px;">
              <label class="form-label">Price Impact on Companies (&Delta; Price)</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${priceInputs}
              </div>
            </div>
          </div>
        `;
      }).join('');

      openModal('modal-event');
    },

    saveEventFromModal: function () {
      var eId = document.getElementById('input-event-id').value;
      var ev = state.events.find(function (e) { return e.id === eId; });
      if (!ev) return;

      ev.name = document.getElementById('input-event-name').value.trim();
      ev.isBadEvent = document.getElementById('input-event-is-bad').value === 'true';
      ev.description = document.getElementById('input-event-desc').value.trim();

      // Checkboxes
      var checkedCo = [];
      document.querySelectorAll('input[name="ev-aff-co"]:checked').forEach(function (cb) {
        checkedCo.push(cb.value);
      });
      ev.affectedCompanies = checkedCo;

      // Options
      ev.options.forEach(function (opt, oIdx) {
        var nameInput = document.getElementById('opt-name-' + oIdx);
        var costInput = document.getElementById('opt-cost-' + oIdx);
        if (nameInput) opt.name = nameInput.value.trim();
        if (costInput) opt.cost = parseFloat(costInput.value) || 0;

        var priceChanges = {};
        state.companies.forEach(function (c) {
          var pEl = document.getElementById('opt-price-' + oIdx + '-' + c.id);
          if (pEl) {
            var val = parseFloat(pEl.value) || 0;
            if (val !== 0) priceChanges[c.id] = val;
          }
        });
        opt.priceChanges = priceChanges;
      });

      saveState();
      closeModal('modal-event');
      renderEvents();
      showToast('Event configuration updated.');
    }
  };

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
