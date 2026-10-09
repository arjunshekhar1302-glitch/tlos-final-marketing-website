# TLOS — The Market Simulation Evaluation Platform

> **Collegiate Stock-Market Simulation Evaluation, Scoring Engine & Tournament Operations Hub**  
> Designed for **TLOS — The Market Simulation** Hackathon / College Event.

---

## 🏛️ Executive Summary

TLOS is a standalone, client-side web application built for event organizers, judges, and participants. It coordinates the entire tournament lifecycle after Phase 1 portfolio construction:
1. **Team & Company Management** with Phase 1 portfolio tracking (cash and stock quantities).
2. **6 Simulation Events** (including exactly 3 Bad Events) with configurable options, costs, and price impact.
3. **Simulation Control & Decision Logging** with real-time portfolio net worth impact calculation and duplicate-entry prevention.
4. **Mandatory Official Scoring Engine** executing the official, uncompromised formulas (Financial Return, Decision Quality, Risk Management, Top 5 Selection, and Stage Judge Bonuses).
5. **Score Audit Inspector** for granular admin review of every formula input and edge case.
6. **Projector Arena Display Mode** for auditorium presentation with live countdown timers, market tickers, and published standings without administrative controls.
7. **Printable A4 Trade Reports** featuring event-by-event trade tables and team written reflection prompts.
8. **Automated Verification Test Suite** guaranteeing 100% adherence to all competition rules.

---

## 📐 Official Scoring Engine Specifications

The platform implements the official tournament evaluation rules without simplification:

| Evaluation Component | Maximum Points | Description |
| :--- | :---: | :--- |
| **Metric 1: Financial Return** | **50 pts** | Final Net Worth = Cash + $\sum(\text{Qty} \times \text{Frozen Final Price})$.<br>Formula: $50 \times \frac{N - \text{Rank}}{N - 1}$.<br>Tied teams receive the exact average of ranks occupied. |
| **Metric 2: Decision Quality** | **30 pts** | 6 events worth 5 pts each. Evaluated using the team's pre-event holdings.<br>Formula: $5 \times \frac{\text{Chosen} - \text{Worst}}{\text{Best} - \text{Worst}}$.<br>Awards **2.5 pts** if 0 affected shares are owned or if Best equals Worst. |
| **Metric 3: Risk Management** | **20 pts** | **Diversification (10 pts)**: Count of distinct companies held after Phase 1 (3 cos = 4, 4 cos = 6, 5 cos = 8, 6 cos = 10, $<3$ = 0).<br>**Downside Control (10 pts)**: $10 \times (1 - \frac{\text{Team Loss}}{\text{Room Max Loss}})$ across the 3 Bad Events. (0 loss = 10 pts, max loss = 0 pts). |
| **Automatic Score** | **100 pts** | $\text{Financial Return} + \text{Decision Quality} + \text{Risk Management}$. |
| **Judge Bonus** | **0–3 pts** | Awarded **strictly to Top 5 teams**. Binary criteria: Clarity (0/1), Justification (0/1), Q&A (0/1). Multiple judges averaged and rounded to nearest whole integer. |
| **Final Maximum Score** | **103 pts** | $\text{Automatic Score} + \text{Judge Bonus}$. |

### Tie-Breaking Hierarchy
- **Top 5 Selection Tie-Break (5th Place)**:
  1. Higher Financial Return points.
  2. Higher remaining cash.
  3. Marked for organizer resolution.
- **Final Standings Tie-Break**:
  1. Higher Financial Return points.
  2. Higher remaining cash.
  3. One-question judge call.

---

## 💻 Tech Stack & Zero-Dependency Architecture

- **Frontend**: Semantic HTML5, CSS3 (Fintech Terminal Design System), Vanilla JavaScript (ES5/ES6 compatible).
- **Persistence**: `localStorage` with automated state sync, JSON Backup export, and schema-validated JSON import.
- **Reports & Export**: Built-in CSS `@media print` tuned for standard A4 pages, client-side PDF export via `html2pdf.js`, and CSV data export.
- **Audio Synthesis**: Web Audio API synthesized harmonic chime for stage countdown timers (zero external MP3 assets needed).
- **Deployment**: Works straight out of the box in any modern browser, Antigravity preview, local web server, or GitHub Pages.

---

## 🚀 Quick Start & How to Run

### Method 1: Direct File Launch
Double click `index.html` or open it directly in Google Chrome, Microsoft Edge, Firefox, or Safari.

### Method 2: Local Web Server (Node.js)
```bash
# In the project directory:
npx serve .
# Or using Node directly:
node -e "const http = require('http'), fs = require('fs'), path = require('path'); http.createServer((q, r) => fs.readFile(path.join(__dirname, q.url === '/' ? 'index.html' : q.url), (e, d) => { r.writeHead(e ? 404 : 200); r.end(d || '404'); })).listen(3000, () => console.log('Running at http://localhost:3000'));"
```

### Method 3: Python Simple Server
```bash
python -m http.server 8000
```

---

## 🧪 Automated Test Suite

A standalone test suite verifies all mathematical calculations:
```bash
node tests/scoring.test.js
```
The application also includes an interactive in-browser test runner modal (`🧪 Run Engine Tests` button in the header) which executes all tests in real time and reports validation status.

---

## 📁 Project Structure

```
tlos-market-simulation/
├── index.html          # Main application structure with 13 dashboard views & projector overlay
├── style.css           # Premium fintech terminal stylesheet, animations, and A4 print styles
├── scoring.js          # Pure, isolated official mathematical scoring engine
├── data.js             # Default demo dataset (10 teams, 6 companies, 6 events, judge scores)
├── script.js           # Application state controller, UI interactions, timer, and export handlers
├── tests/
│   └── scoring.test.js # 14-point test suite checking all rules and edge cases
└── README.md           # Documentation and operations guide
```
