const fs = require("fs");

const { createObjectCsvWriter } = require("csv-writer");

// =====================================================
// GENERATE FINAL STATE CSV
// =====================================================

async function generateFinalStateReport(items) {
  // Ensure outputs folder exists
  if (!fs.existsSync("outputs")) {
    fs.mkdirSync("outputs");
  }

  // Configure CSV writer
  const csvWriter = createObjectCsvWriter({
    path: "outputs/final_state.csv",

    header: [
      {
        id: "item_id",
        title: "item_id",
      },

      {
        id: "item_type",
        title: "item_type",
      },

      {
        id: "status",
        title: "status",
      },

      {
        id: "holder",
        title: "holder",
      },

      {
        id: "due",
        title: "due",
      },

      {
        id: "condition",
        title: "condition",
      },
    ],
  });

  // Convert Map to array
  const records = Array.from(items.values());

  // Write CSV
  await csvWriter.writeRecords(records);

  console.log("final_state.csv generated");
}
// =====================================================
// GENERATE ANOMALIES CSV
// =====================================================

async function generateAnomaliesReport(anomalies) {
  // Configure CSV writer
  const csvWriter = createObjectCsvWriter({
    path: "outputs/anomalies.csv",

    header: [
      {
        id: "severity",
        title: "severity",
      },

      {
        id: "reason_code",
        title: "reason_code",
      },

      {
        id: "event_id",
        title: "event_id",
      },

      {
        id: "item_id",
        title: "item_id",
      },

      {
        id: "actor_id",
        title: "actor_id",
      },

      {
        id: "message",
        title: "message",
      },
    ],
  });

  // Write anomaly records
  await csvWriter.writeRecords(anomalies);

  console.log("anomalies.csv generated");
}
// =====================================================
// GENERATE STUDENT SUMMARY CSV
// =====================================================

async function generateStudentSummaryReport(studentActiveItems) {
  // Configure CSV writer
  const csvWriter = createObjectCsvWriter({
    path: "outputs/student_summary.csv",

    header: [
      {
        id: "student_id",
        title: "student_id",
      },

      {
        id: "active_items",
        title: "active_items",
      },
    ],
  });

  // Convert Map into array
  const records = Array.from(studentActiveItems.entries()).map(
    ([student_id, active_items]) => {
      return {
        student_id,
        active_items,
      };
    },
  );

  // Write CSV
  await csvWriter.writeRecords(records);

  console.log("student_summary.csv generated");
}
// =====================================================
// GENERATE RUN SUMMARY MARKDOWN
// =====================================================

async function generateRunSummaryReport(
  inventory,
  events,
  validEvents,
  anomalies,
  items
) {

  const fs =
    require("fs");


  // Count final statuses
  let available = 0;

  let checked_out = 0;

  let maintenance = 0;


  for (const item of items.values()) {

    if (item.status === "available") {
      available++;
    }

    if (item.status === "checked_out") {
      checked_out++;
    }

    if (item.status === "maintenance") {
      maintenance++;
    }
  }


  // Markdown content
  const markdown = `# Run Summary

## Totals

- Inventory items: ${inventory.length}
- Raw events: ${events.length}
- Valid events: ${validEvents.length}
- Anomalies: ${anomalies.length}

## Final Status Counts

- available: ${available}
- checked_out: ${checked_out}
- maintenance: ${maintenance}
`;


  // Write markdown file
  fs.writeFileSync(
    "outputs/run_summary.md",
    markdown
  );


  console.log(
    "run_summary.md generated"
  );
}
module.exports = {
  generateFinalStateReport,
  generateAnomaliesReport,
  generateStudentSummaryReport,
  generateRunSummaryReport,
};
