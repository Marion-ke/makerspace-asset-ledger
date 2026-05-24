# Makerspace Asset Ledger

A Node.js event-driven inventory tracking system for managing Makerspace equipment loans, returns, maintenance workflows, and anomaly detection.

---

# Features

- Inventory validation
- Event validation
- Chronological event processing
- Student item limit enforcement
- Loan duration calculation
- Maintenance workflows
- Condition tracking
- Anomaly detection
- CSV report generation
- Markdown run summaries

---

# Supported Event Types

- CHECKOUT
- RETURN
- STAFF_RETURN
- MARK_MAINTENANCE
- RESTORE

---

# Project Structure

project-root/
│
├── data/
│ ├── inventory.csv
│ ├── events.csv
│ └── policy.json
│
├── output/
│
├── src/
│ ├── main.js
│ ├── parser.js
│ ├── validator.js
│ ├── processor.js
│ ├── reports.js
│ ├── helpers.js
│ └── models.js
│
├── tests/
│
├── README.md
├── ASSUMPTIONS.md
├── TRACE.md
├── TEST_PLAN.md
└── AI_AND_ASSISTANCE.md

# Installation

```bash
npm install
```

---

# Run The Project

```bash
node src/main.js
```

# Requirements

- Node.js v18+

# Generated inside

outputs/
final_state.csv
anomalies.csv
student_summary.csv
run_summary.md

# Additional documentation:

TRACE.md
TEST_PLAN.md

# technologies used

Node.js
csv-parser
csv-writer

# References

- https://nodejs.org/docs
- https://www.npmjs.com/package/csv-parser
- https://www.npmjs.com/package/csv-writer
- https://developer.mozilla.org/en-US/docs/Web/JavaScript
