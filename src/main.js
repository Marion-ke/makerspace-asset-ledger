const path = require("path");

const { readCSV, readJSON } = require("./parser");

const { validateInventory, validateEvents } = require("./validator");

const {
  processCheckout,
  processReturn,
  processStaffReturn,
  processMarkMaintenance,
  processRestore,
} = require("./processor");

const {
  generateFinalStateReport,
  generateAnomaliesReport,
  generateStudentSummaryReport,
  generateRunSummaryReport,
} = require("./reports");

async function main() {
  try {
    // File paths
    const inventoryPath = path.join(__dirname, "../data/inventory.csv");

    const eventsPath = path.join(__dirname, "../data/events.csv");

    const policyPath = path.join(__dirname, "../data/policy.json");

    // Load files
    const inventory = await readCSV(inventoryPath);

    const events = await readCSV(eventsPath);

    const policy = readJSON(policyPath);

    // Internal state
    const items = new Map();

    const anomalies = [];

    const validEvents = [];

    const studentActiveItems = new Map();

    // Validation
    validateInventory(inventory, items, anomalies, studentActiveItems);

    validateEvents(events, validEvents, anomalies);

    // Process events
    for (const event of validEvents) {
      if (event.action === "CHECKOUT") {
        processCheckout(event, items, anomalies, studentActiveItems, policy);
      }

      if (event.action === "RETURN") {
        processReturn(event, items, anomalies, studentActiveItems, policy);
      }

      if (event.action === "STAFF_RETURN") {
        processStaffReturn(event, items, anomalies, studentActiveItems, policy);
      }

      if (event.action === "MARK_MAINTENANCE") {
        processMarkMaintenance(event, items, anomalies);
      }

      if (event.action === "RESTORE") {
        processRestore(event, items, anomalies);
      }
    }
    await generateFinalStateReport(items);
    await generateAnomaliesReport(anomalies);
    await generateStudentSummaryReport(studentActiveItems);
    await generateRunSummaryReport(
      inventory,
      events,
      validEvents,
      anomalies,
      items,
    );
    // Debug output
    console.log("========== SUMMARY ==========");

    console.log("Inventory items:", inventory.length);

    console.log("Valid events:", validEvents.length);

    console.log("Anomalies found:", anomalies.length);
    console.log(Array.from(items.values()));
  } catch (error) {
    console.error(error);
  }
}

main();
