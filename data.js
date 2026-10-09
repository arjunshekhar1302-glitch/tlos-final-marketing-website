/**
 * TLOS — Default Data & Demo Scenarios
 * 
 * Contains:
 * - 6 Demo Companies
 * - 6 Configurable Demo Events (including 3 Bad Events)
 * - 10 Demo Teams with Phase 1 Starting Portfolios
 * - Example Choices & Outcomes
 * - Sample Judge Scores
 * - Reflection Prompts Template
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.TLOSDefaultData = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_COMPANIES = [
    {
      id: 'TECH',
      name: 'Apex Robotics & AI',
      ticker: 'TECH',
      sector: 'Technology',
      startingPrice: 150,
      currentPrice: 165,
      frozenFinalPrice: 180,
      description: 'Industrial robotics and autonomous intelligence systems.'
    },
    {
      id: 'ENER',
      name: 'Vanguard Energy Corp',
      ticker: 'ENER',
      sector: 'Energy',
      startingPrice: 90,
      currentPrice: 82,
      frozenFinalPrice: 75,
      description: 'Oil, natural gas, and developing clean hydrogen infrastructure.'
    },
    {
      id: 'PHAR',
      name: 'BioGenesis Pharma',
      ticker: 'PHAR',
      sector: 'Healthcare',
      startingPrice: 120,
      currentPrice: 135,
      frozenFinalPrice: 140,
      description: 'Breakthrough mRNA gene therapies and clinical oncology.'
    },
    {
      id: 'FIN',
      name: 'Nexus Global Bank',
      ticker: 'FIN',
      sector: 'Financials',
      startingPrice: 60,
      currentPrice: 58,
      frozenFinalPrice: 62,
      description: 'Multinational commercial banking and debt underwriting.'
    },
    {
      id: 'AERO',
      name: 'Stratosphere Aerospace',
      ticker: 'AERO',
      sector: 'Defense & Aerospace',
      startingPrice: 110,
      currentPrice: 115,
      frozenFinalPrice: 105,
      description: 'Defense aviation, orbital satellites, and drone tech.'
    },
    {
      id: 'CONS',
      name: 'Omni Consumer Retail',
      ticker: 'CONS',
      sector: 'Consumer Goods',
      startingPrice: 45,
      currentPrice: 42,
      frozenFinalPrice: 40,
      description: 'Global omnichannel retail and logistics fulfillment.'
    }
  ];

  var DEFAULT_EVENTS = [
    {
      id: 'EV_1',
      order: 1,
      name: '[DEMO] Supply Chain Bottleneck',
      isBadEvent: true, // Bad Event 1
      status: 'completed', // completed / active / pending
      affectedCompanies: ['TECH', 'AERO'],
      description: 'Severe maritime port congestions and rare-earth semiconductor shortages delay component deliveries across hardware tech and aerospace assemblies.',
      options: [
        {
          id: 'OPT_1_A',
          name: 'Option A: Contract Expedited Air Freight',
          description: 'Pay a premium fee to bypass ocean freight and secure priority aircraft shipping.',
          cost: 2500,
          cashAdjustment: 0,
          priceChanges: { 'TECH': -5, 'AERO': -3 }
        },
        {
          id: 'OPT_1_B',
          name: 'Option B: Absorb Supply Delays (Status Quo)',
          description: 'Take no emergency action. Accept delayed customer deliverables and penalties.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'TECH': -22, 'AERO': -16 }
        },
        {
          id: 'OPT_1_C',
          name: 'Option C: Pre-buy Hedged Inventory & Swaps',
          description: 'Hedge against raw material swings with structured supplier swaps.',
          cost: 4000,
          cashAdjustment: 0,
          priceChanges: { 'TECH': 2, 'AERO': 0 }
        }
      ]
    },
    {
      id: 'EV_2',
      order: 2,
      name: '[DEMO] Landmark Clinical Trial Success',
      isBadEvent: false, // Standard Event
      status: 'completed',
      affectedCompanies: ['PHAR'],
      description: 'BioGenesis Pharma announces successful Phase III clinical trial results for its breakthrough universal mRNA antiviral treatment.',
      options: [
        {
          id: 'OPT_2_A',
          name: 'Option A: Aggressive Commercial Production Rollout',
          description: 'Invest capital in scaling automated bioreactors ahead of FDA fast-track clearance.',
          cost: 3000,
          cashAdjustment: 0,
          priceChanges: { 'PHAR': 28 }
        },
        {
          id: 'OPT_2_B',
          name: 'Option B: Standard Phased Market Entry',
          description: 'Follow regular multi-stage release without extra capital expenditure.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'PHAR': 15 }
        },
        {
          id: 'OPT_2_C',
          name: 'Option C: Conservative International Licensing Deal',
          description: 'License distribution rights to regional conglomerates for immediate upfront cash royalties.',
          cost: 0,
          cashAdjustment: 2000,
          priceChanges: { 'PHAR': 7 }
        }
      ]
    },
    {
      id: 'EV_3',
      order: 3,
      name: '[DEMO] Central Bank Rate Shock',
      isBadEvent: true, // Bad Event 2
      status: 'completed',
      affectedCompanies: ['FIN', 'TECH'],
      description: 'Inflation spikes lead central bankers to raise interest rates unexpectedly by 75 basis points, compressing technology multiples and raising funding costs.',
      options: [
        {
          id: 'OPT_3_A',
          name: 'Option A: Restructure Debt & Short-Term Liquidity Buffer',
          description: 'Pay banking advisory fee to lock in floating debt caps and shore up short-term treasury bills.',
          cost: 2000,
          cashAdjustment: 0,
          priceChanges: { 'FIN': -2, 'TECH': -6 }
        },
        {
          id: 'OPT_3_B',
          name: 'Option B: Maintain Existing Debt Structure',
          description: 'No action taken. Expose balance sheet fully to heightened debt servicing costs.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'FIN': -9, 'TECH': -18 }
        },
        {
          id: 'OPT_3_C',
          name: 'Option C: Aggressive Credit Underwriting Shift',
          description: 'Pivot into floating-rate corporate credit spreads, offsetting funding strain.',
          cost: 3500,
          cashAdjustment: 0,
          priceChanges: { 'FIN': 3, 'TECH': -5 }
        }
      ]
    },
    {
      id: 'EV_4',
      order: 4,
      name: '[DEMO] Clean Energy Infrastructure Initiative',
      isBadEvent: false, // Standard Event
      status: 'completed',
      affectedCompanies: ['ENER'],
      description: 'Bipartisan climate and energy bill signs into law massive production tax credits and transmission grid modernization grants.',
      options: [
        {
          id: 'OPT_4_A',
          name: 'Option A: Accelerated Clean Hydrogen Grid Pivot',
          description: 'Reallocate capital expenditures into qualifying clean green-energy tax programs.',
          cost: 3500,
          cashAdjustment: 0,
          priceChanges: { 'ENER': 24 }
        },
        {
          id: 'OPT_4_B',
          name: 'Option B: Balanced Hybrid Exploration',
          description: 'Modest capital commitment to qualify for tier-2 federal grants.',
          cost: 1200,
          cashAdjustment: 0,
          priceChanges: { 'ENER': 12 }
        },
        {
          id: 'OPT_4_C',
          name: 'Option C: Stick to Traditional Fossil Margins',
          description: 'Maintain status-quo fossil operations, paying zero transition costs.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'ENER': -3 }
        }
      ]
    },
    {
      id: 'EV_5',
      order: 5,
      name: '[DEMO] Critical Cyber Breach & Systems Ransomware',
      isBadEvent: true, // Bad Event 3
      status: 'completed',
      affectedCompanies: ['CONS', 'FIN'],
      description: 'Coordinated zero-day cyber attack penetrates customer point-of-sale servers and banking authentication APIs, threatening public reputation.',
      options: [
        {
          id: 'OPT_5_A',
          name: 'Option A: Immediate Forensics & White-Hat Containment',
          description: 'Retain top cybersecurity incident response firm and deploy endpoint patches.',
          cost: 3000,
          cashAdjustment: 0,
          priceChanges: { 'CONS': -4, 'FIN': -3 }
        },
        {
          id: 'OPT_5_B',
          name: 'Option B: Delayed Public Disclosure & Internal Patching',
          description: 'Rely on internal IT team to remediate quietly without external consultants.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'CONS': -16, 'FIN': -14 }
        },
        {
          id: 'OPT_5_C',
          name: 'Option C: Comprehensive Cyber Liability Insurance Claim',
          description: 'Execute rapid insurance claims process covering merchant liabilities.',
          cost: 1500,
          cashAdjustment: 0,
          priceChanges: { 'CONS': -7, 'FIN': -6 }
        }
      ]
    },
    {
      id: 'EV_6',
      order: 6,
      name: '[DEMO] Orbital Defense & Satellite Procurement',
      isBadEvent: false, // Standard Event
      status: 'completed',
      affectedCompanies: ['AERO'],
      description: 'Global Defense Consortium issues a multi-year competitive contract tender for next-generation orbital tracking satellites.',
      options: [
        {
          id: 'OPT_6_A',
          name: 'Option A: Lead Prime Contractor Bid',
          description: 'Invest in proprietary radar prototypes to bid as sole prime contractor for maximum margins.',
          cost: 4000,
          cashAdjustment: 0,
          priceChanges: { 'AERO': 32 }
        },
        {
          id: 'OPT_6_B',
          name: 'Option B: Joint Venture Subcontractor Bid',
          description: 'Partner with international primes to split bidding risk and overhead costs.',
          cost: 1500,
          cashAdjustment: 0,
          priceChanges: { 'AERO': 18 }
        },
        {
          id: 'OPT_6_C',
          name: 'Option C: Abstain from Defense Tender',
          description: 'Focus resources exclusively on commercial aerospace operations.',
          cost: 0,
          cashAdjustment: 0,
          priceChanges: { 'AERO': 0 }
        }
      ]
    }
  ];

  var DEMO_TEAMS = [
    {
      id: 'TEAM_01',
      name: 'Vanguard Capital',
      startingCash: 35000,
      cash: 28500,
      startingHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, // 6 companies = 10 pts diversification
      holdings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 },
      reflections: {
        portfolioReason: 'We built a 6-pillar all-weather portfolio covering growth tech, defensive pharma, and essential financials to achieve maximal diversification while preserving dry powder.',
        keyDecision: 'In Event 1, choosing Option A (air freight) minimized assembly disruption for robotics, preventing downstream cancellations.',
        whatToChange: 'We would have allocated more cash toward aerospace tenders in Event 6 to capture the prime contractor upside.'
      }
    },
    {
      id: 'TEAM_02',
      name: 'Quantum Alpha',
      startingCash: 40000,
      cash: 31000,
      startingHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, // 5 companies = 8 pts diversification
      holdings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 },
      reflections: {
        portfolioReason: 'Focused on high-margin intellectual property and critical infrastructure with a heavy beta weighting toward technology and biotech.',
        keyDecision: 'Investing aggressively in Phase 3 oncology trial commercialization (Event 2 Option A), capturing the +$28 PHAR surge.',
        whatToChange: 'We should have hedged against rate hikes in Event 3 more actively rather than absorbing tech multiple compression.'
      }
    },
    {
      id: 'TEAM_03',
      name: 'Aegis Hedge Partners',
      startingCash: 32000,
      cash: 25500,
      startingHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, // 6 companies = 10 pts
      holdings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 },
      reflections: {
        portfolioReason: 'Balanced risk parity portfolio with strict downside exposure limits across all three high-volatility sectors.',
        keyDecision: 'Purchased cyber liability insurance and quick remediation in Event 5, mitigating loss across retail and banking holdings.',
        whatToChange: 'Taken a larger stake in BioGenesis Pharma prior to the Phase 3 clinical trial announcements.'
      }
    },
    {
      id: 'TEAM_04',
      name: 'Blackstone Pioneers',
      startingCash: 45000,
      cash: 36000,
      startingHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, // 4 companies = 6 pts
      holdings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 },
      reflections: {
        portfolioReason: 'Concentrated conviction in core enterprise technologies and sovereign energy transition assets.',
        keyDecision: 'Deciding to accelerate the green hydrogen grid pivot in Event 4 to maximize tax credit capital appreciation.',
        whatToChange: 'Adding aerospace exposure to capture defense budget tailwinds.'
      }
    },
    {
      id: 'TEAM_05',
      name: 'Citadel Horizon',
      startingCash: 30000,
      cash: 23800,
      startingHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, // 5 companies = 8 pts
      holdings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 },
      reflections: {
        portfolioReason: 'Constructed an asymmetric growth portfolio leveraging defense contracts and consumer e-commerce scale.',
        keyDecision: 'Bidding as lead prime contractor on orbital defense tender in Event 6, creating substantial equity revaluation.',
        whatToChange: 'Managing cash reserves more defensively during the interest rate shock event.'
      }
    },
    {
      id: 'TEAM_06',
      name: 'Apex Horizon Fund',
      startingCash: 38000,
      cash: 32000,
      startingHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, // 3 companies = 4 pts
      holdings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 },
      reflections: {
        portfolioReason: 'Concentrated industrial tech growth bet.',
        keyDecision: 'Hedging semiconductor components early in Event 1.',
        whatToChange: 'Diversifying into pharmaceuticals to reduce sector concentration.'
      }
    },
    {
      id: 'TEAM_07',
      name: 'Sigma Market Makers',
      startingCash: 42000,
      cash: 34500,
      startingHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, // 3 companies = 4 pts
      holdings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 },
      reflections: {
        portfolioReason: 'Value-oriented cash flow yield portfolio.',
        keyDecision: 'Absorbed cyber breach costs with internal patching in Event 5.',
        whatToChange: 'Allocated earlier into technology growth companies.'
      }
    },
    {
      id: 'TEAM_08',
      name: 'Omni Capital Partners',
      startingCash: 50000,
      cash: 42000,
      startingHoldings: { 'TECH': 220, 'PHAR': 80 }, // 2 companies = 0 pts diversification
      holdings: { 'TECH': 220, 'PHAR': 80 },
      reflections: {
        portfolioReason: 'Ultra-concentrated high beta tech & pharma bet.',
        keyDecision: 'Funded clinical trial manufacturing in Event 2.',
        whatToChange: 'Spread starting capital across more than 2 sectors.'
      }
    },
    {
      id: 'TEAM_09',
      name: 'Velocity Growth Fund',
      startingCash: 30000,
      cash: 24000,
      startingHoldings: { 'ENER': 250, 'CONS': 200 }, // 2 companies = 0 pts
      holdings: { 'ENER': 250, 'CONS': 200 },
      reflections: {
        portfolioReason: 'Cyclical commodities and retail portfolio.',
        keyDecision: 'Green energy subsidy capture.',
        whatToChange: 'Poor downside protection during retail cyber attack.'
      }
    },
    {
      id: 'TEAM_10',
      name: 'Hyperion Asset Mgmt',
      startingCash: 48000,
      cash: 40000,
      startingHoldings: { 'TECH': 250 }, // 1 company = 0 pts diversification
      holdings: { 'TECH': 250 },
      reflections: {
        portfolioReason: 'Single-stock conviction play in robotics.',
        keyDecision: 'Contracting air freight in Event 1.',
        whatToChange: 'Total lack of sector diversification.'
      }
    }
  ];

  // Pre-configured demo event logs for the 10 teams across 6 events
  var DEMO_EVENT_LOGS = {
    'EV_1': {
      'TEAM_01': { chosenOptionId: 'OPT_1_A', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 35000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_02': { chosenOptionId: 'OPT_1_C', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 40000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_03': { chosenOptionId: 'OPT_1_C', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 32000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_04': { chosenOptionId: 'OPT_1_A', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 45000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_05': { chosenOptionId: 'OPT_1_A', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 30000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_06': { chosenOptionId: 'OPT_1_C', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 38000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_07': { chosenOptionId: 'OPT_1_B', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 42000, prePrices: { 'TECH': 150, 'AERO': 110 } }, // 0 shares affected!
      'TEAM_08': { chosenOptionId: 'OPT_1_B', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 50000, prePrices: { 'TECH': 150, 'AERO': 110 } },
      'TEAM_09': { chosenOptionId: 'OPT_1_B', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 30000, prePrices: { 'TECH': 150, 'AERO': 110 } }, // 0 shares affected!
      'TEAM_10': { chosenOptionId: 'OPT_1_B', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'TECH': 150, 'AERO': 110 } }
    },
    'EV_2': {
      'TEAM_01': { chosenOptionId: 'OPT_2_A', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 32500, prePrices: { 'PHAR': 120 } },
      'TEAM_02': { chosenOptionId: 'OPT_2_A', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 36000, prePrices: { 'PHAR': 120 } },
      'TEAM_03': { chosenOptionId: 'OPT_2_B', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 28000, prePrices: { 'PHAR': 120 } },
      'TEAM_04': { chosenOptionId: 'OPT_2_A', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 42500, prePrices: { 'PHAR': 120 } },
      'TEAM_05': { chosenOptionId: 'OPT_2_B', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 27500, prePrices: { 'PHAR': 120 } },
      'TEAM_06': { chosenOptionId: 'OPT_2_B', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 34000, prePrices: { 'PHAR': 120 } }, // 0 shares
      'TEAM_07': { chosenOptionId: 'OPT_2_B', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 42000, prePrices: { 'PHAR': 120 } }, // 0 shares
      'TEAM_08': { chosenOptionId: 'OPT_2_A', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 50000, prePrices: { 'PHAR': 120 } },
      'TEAM_09': { chosenOptionId: 'OPT_2_B', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 30000, prePrices: { 'PHAR': 120 } }, // 0 shares
      'TEAM_10': { chosenOptionId: 'OPT_2_B', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'PHAR': 120 } } // 0 shares
    },
    'EV_3': {
      'TEAM_01': { chosenOptionId: 'OPT_3_A', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 29500, prePrices: { 'FIN': 60, 'TECH': 145 } },
      'TEAM_02': { chosenOptionId: 'OPT_3_A', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 33000, prePrices: { 'FIN': 60, 'TECH': 152 } },
      'TEAM_03': { chosenOptionId: 'OPT_3_A', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 28000, prePrices: { 'FIN': 60, 'TECH': 152 } },
      'TEAM_04': { chosenOptionId: 'OPT_3_B', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 39500, prePrices: { 'FIN': 60, 'TECH': 145 } },
      'TEAM_05': { chosenOptionId: 'OPT_3_A', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 27500, prePrices: { 'FIN': 60, 'TECH': 145 } },
      'TEAM_06': { chosenOptionId: 'OPT_3_B', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 34000, prePrices: { 'FIN': 60, 'TECH': 152 } },
      'TEAM_07': { chosenOptionId: 'OPT_3_A', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 42000, prePrices: { 'FIN': 60, 'TECH': 150 } },
      'TEAM_08': { chosenOptionId: 'OPT_3_B', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 47000, prePrices: { 'FIN': 60, 'TECH': 128 } },
      'TEAM_09': { chosenOptionId: 'OPT_3_B', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 30000, prePrices: { 'FIN': 60, 'TECH': 150 } }, // 0 shares
      'TEAM_10': { chosenOptionId: 'OPT_3_B', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'FIN': 60, 'TECH': 128 } }
    },
    'EV_4': {
      'TEAM_01': { chosenOptionId: 'OPT_4_B', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 27500, prePrices: { 'ENER': 90 } },
      'TEAM_02': { chosenOptionId: 'OPT_4_B', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 31000, prePrices: { 'ENER': 90 } },
      'TEAM_03': { chosenOptionId: 'OPT_4_A', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 26000, prePrices: { 'ENER': 90 } },
      'TEAM_04': { chosenOptionId: 'OPT_4_A', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 39500, prePrices: { 'ENER': 90 } },
      'TEAM_05': { chosenOptionId: 'OPT_4_C', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 25500, prePrices: { 'ENER': 90 } }, // 0 shares
      'TEAM_06': { chosenOptionId: 'OPT_4_B', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 34000, prePrices: { 'ENER': 90 } },
      'TEAM_07': { chosenOptionId: 'OPT_4_A', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 40000, prePrices: { 'ENER': 90 } },
      'TEAM_08': { chosenOptionId: 'OPT_4_C', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 47000, prePrices: { 'ENER': 90 } }, // 0 shares
      'TEAM_09': { chosenOptionId: 'OPT_4_A', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 30000, prePrices: { 'ENER': 90 } },
      'TEAM_10': { chosenOptionId: 'OPT_4_C', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'ENER': 90 } } // 0 shares
    },
    'EV_5': {
      'TEAM_01': { chosenOptionId: 'OPT_5_A', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 26300, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_02': { chosenOptionId: 'OPT_5_C', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 29800, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_03': { chosenOptionId: 'OPT_5_A', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 22500, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_04': { chosenOptionId: 'OPT_5_C', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 36000, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_05': { chosenOptionId: 'OPT_5_A', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 25500, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_06': { chosenOptionId: 'OPT_5_B', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 32800, prePrices: { 'CONS': 45, 'FIN': 58 } }, // 0 shares
      'TEAM_07': { chosenOptionId: 'OPT_5_B', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 36500, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_08': { chosenOptionId: 'OPT_5_B', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 47000, prePrices: { 'CONS': 45, 'FIN': 58 } }, // 0 shares
      'TEAM_09': { chosenOptionId: 'OPT_5_B', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 26500, prePrices: { 'CONS': 45, 'FIN': 58 } },
      'TEAM_10': { chosenOptionId: 'OPT_5_B', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'CONS': 45, 'FIN': 58 } } // 0 shares
    },
    'EV_6': {
      'TEAM_01': { chosenOptionId: 'OPT_6_B', preHoldings: { 'TECH': 150, 'ENER': 120, 'PHAR': 100, 'FIN': 200, 'AERO': 80, 'CONS': 150 }, preCash: 23300, prePrices: { 'AERO': 110 } },
      'TEAM_02': { chosenOptionId: 'OPT_6_A', preHoldings: { 'TECH': 180, 'PHAR': 140, 'AERO': 120, 'FIN': 100, 'ENER': 80 }, preCash: 28300, prePrices: { 'AERO': 110 } },
      'TEAM_03': { chosenOptionId: 'OPT_6_B', preHoldings: { 'TECH': 110, 'ENER': 150, 'PHAR': 120, 'FIN': 180, 'AERO': 90, 'CONS': 100 }, preCash: 19500, prePrices: { 'AERO': 110 } },
      'TEAM_04': { chosenOptionId: 'OPT_6_C', preHoldings: { 'TECH': 120, 'PHAR': 110, 'FIN': 140, 'ENER': 160 }, preCash: 34500, prePrices: { 'AERO': 110 } }, // 0 shares
      'TEAM_05': { chosenOptionId: 'OPT_6_A', preHoldings: { 'TECH': 160, 'AERO': 140, 'PHAR': 90, 'CONS': 180, 'FIN': 110 }, preCash: 22500, prePrices: { 'AERO': 110 } },
      'TEAM_06': { chosenOptionId: 'OPT_6_B', preHoldings: { 'TECH': 200, 'AERO': 100, 'ENER': 100 }, preCash: 32800, prePrices: { 'AERO': 110 } },
      'TEAM_07': { chosenOptionId: 'OPT_6_C', preHoldings: { 'FIN': 220, 'CONS': 190, 'ENER': 130 }, preCash: 36500, prePrices: { 'AERO': 110 } }, // 0 shares
      'TEAM_08': { chosenOptionId: 'OPT_6_C', preHoldings: { 'TECH': 220, 'PHAR': 80 }, preCash: 47000, prePrices: { 'AERO': 110 } }, // 0 shares
      'TEAM_09': { chosenOptionId: 'OPT_6_C', preHoldings: { 'ENER': 250, 'CONS': 200 }, preCash: 26500, prePrices: { 'AERO': 110 } }, // 0 shares
      'TEAM_10': { chosenOptionId: 'OPT_6_C', preHoldings: { 'TECH': 250 }, preCash: 48000, prePrices: { 'AERO': 110 } } // 0 shares
    }
  };

  // Sample judge scores for top 5 teams
  var DEMO_JUDGE_SCORES = {
    'TEAM_01': [
      { judgeName: 'Judge Anderson (FinTech Lead)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Sterling (Macro Hedge Partner)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Mehta (Quantitative Academic)', clarity: 1, justification: 1, qaAnswer: 1 }
    ],
    'TEAM_02': [
      { judgeName: 'Judge Anderson (FinTech Lead)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Sterling (Macro Hedge Partner)', clarity: 1, justification: 1, qaAnswer: 0 },
      { judgeName: 'Judge Mehta (Quantitative Academic)', clarity: 1, justification: 1, qaAnswer: 1 }
    ],
    'TEAM_03': [
      { judgeName: 'Judge Anderson (FinTech Lead)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Sterling (Macro Hedge Partner)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Mehta (Quantitative Academic)', clarity: 0, justification: 1, qaAnswer: 1 }
    ],
    'TEAM_04': [
      { judgeName: 'Judge Anderson (FinTech Lead)', clarity: 1, justification: 1, qaAnswer: 0 },
      { judgeName: 'Judge Sterling (Macro Hedge Partner)', clarity: 1, justification: 0, qaAnswer: 1 },
      { judgeName: 'Judge Mehta (Quantitative Academic)', clarity: 1, justification: 1, qaAnswer: 0 }
    ],
    'TEAM_05': [
      { judgeName: 'Judge Anderson (FinTech Lead)', clarity: 1, justification: 1, qaAnswer: 1 },
      { judgeName: 'Judge Sterling (Macro Hedge Partner)', clarity: 0, justification: 1, qaAnswer: 0 },
      { judgeName: 'Judge Mehta (Quantitative Academic)', clarity: 1, justification: 0, qaAnswer: 1 }
    ]
  };

  return {
    DEFAULT_COMPANIES: DEFAULT_COMPANIES,
    DEFAULT_EVENTS: DEFAULT_EVENTS,
    DEMO_TEAMS: DEMO_TEAMS,
    DEMO_EVENT_LOGS: DEMO_EVENT_LOGS,
    DEMO_JUDGE_SCORES: DEMO_JUDGE_SCORES
  };
}));
