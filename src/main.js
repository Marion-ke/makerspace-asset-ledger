const path = require("path");
const { readCSV, readJSON } = require("./parser");

// =====================================================
// CHECKOUT EVENT PROCESSOR
// =====================================================

function processCheckout(event, items, anomalies, studentActiveItems, policy) {
  // Find item in system
  const item = items.get(event.item_id);

  // =====================================================
  // UNKNOWN ITEM
  // =====================================================

  if (!item) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_ITEM",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item does not exist",
    });

    return;
  }

  // =====================================================
  // ITEM MUST BE AVAILABLE
  // =====================================================

  if (item.status !== "available") {
    anomalies.push({
      severity: "error",
      reason_code: "ITEM_NOT_AVAILABLE",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item is not available for checkout",
    });

    return;
  }

  // =====================================================
  // ACTOR MUST BE STUDENT
  // =====================================================

  if (!event.actor_id.startsWith("s")) {
    anomalies.push({
      severity: "error",
      reason_code: "ACTOR_NOT_STUDENT",
      event_id: event.event_id,
      actor_id: event.actor_id,
      message: "Checkout requires student actor",
    });

    return;
  }

  // =====================================================
  // ACTIVE ITEM LIMIT CHECK
  // =====================================================

  const activeCount = studentActiveItems.get(event.actor_id) || 0;

  if (activeCount >= policy.max_active_items_per_student) {
    anomalies.push({
      severity: "error",
      reason_code: "ITEM_LIMIT_REACHED",
      event_id: event.event_id,
      actor_id: event.actor_id,
      message: "Student reached active item limit",
    });

    return;
  }

  // =====================================================
  // LOAN POLICY CHECK
  // =====================================================

  const loanHours = policy.loan_hours_by_type[item.item_type];

  if (!loanHours) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_LOAN_POLICY",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Missing loan policy for item type",
    });

    return;
  }

  // =====================================================
  // CALCULATE DUE DATE
  // =====================================================

  const dueDate = new Date(event.parsedTimestamp);

  dueDate.setHours(dueDate.getHours() + loanHours);

  // =====================================================
  // UPDATE ITEM STATE
  // =====================================================

  item.status = "checked_out";

  item.holder = event.actor_id;

  item.due = dueDate.toISOString();

  // =====================================================
  // UPDATE STUDENT ACTIVE ITEM COUNT
  // =====================================================

  studentActiveItems.set(event.actor_id, activeCount + 1);
}

// =====================================================
// MAIN PROGRAM
// =====================================================

async function main() {
  try {
    // =====================================================
    // FILE PATHS
    // =====================================================

    const inventoryPath = path.join(__dirname, "../data/inventory.csv");

    const eventsPath = path.join(__dirname, "../data/events.csv");

    const policyPath = path.join(__dirname, "../data/policy.json");

    // =====================================================
    // LOAD FILES
    // =====================================================

    const inventory = await readCSV(inventoryPath);

    const events = await readCSV(eventsPath);

    const policy = readJSON(policyPath);

    // =====================================================
    // INTERNAL SYSTEM STATE
    // =====================================================

    const items = new Map();

    const anomalies = [];

    const validEvents = [];

    const seenEventIds = new Set();

    const studentActiveItems = new Map();

    // =====================================================
    // INVENTORY VALIDATION
    // =====================================================

    for (const row of inventory) {
      const isCheckedOut = row.start_status === "checked_out";

      const hasHolder = row.start_holder !== "";

      const hasDue = row.start_due !== "";

      // -------------------------------------------------
      // INVALID CHECKED_OUT ROW
      // -------------------------------------------------

      if (isCheckedOut && (!hasHolder || !hasDue)) {
        anomalies.push({
          severity: "error",
          reason_code: "BAD_INVENTORY_ROW",
          item_id: row.item_id,
          message: "Checked out item missing holder or due date",
        });
      }

      // -------------------------------------------------
      // INVALID AVAILABLE/MAINTENANCE ROW
      // -------------------------------------------------

      if (
        (row.start_status === "available" ||
          row.start_status === "maintenance") &&
        (hasHolder || hasDue)
      ) {
        anomalies.push({
          severity: "error",
          reason_code: "BAD_INVENTORY_ROW",
          item_id: row.item_id,
          message: "Available or maintenance item should not have holder/due",
        });
      }

      // -------------------------------------------------
      // BUILD INTERNAL ITEM STATE
      // -------------------------------------------------

      items.set(row.item_id, {
        item_id: row.item_id,

        item_type: row.item_type,

        condition: row.condition,

        status: row.start_status,

        holder: row.start_holder || null,

        due: row.start_due || null,
      });
    }

    // =====================================================
    // INITIALIZE ACTIVE STUDENT ITEM COUNTS
    // =====================================================

    for (const item of items.values()) {
      if (item.status === "checked_out") {
        const currentCount = studentActiveItems.get(item.holder) || 0;

        studentActiveItems.set(item.holder, currentCount + 1);
      }
    }

    // =====================================================
    // EVENT VALIDATION
    // =====================================================

    for (const event of events) {
      // -------------------------------------------------
      // MISSING EVENT ID
      // -------------------------------------------------

      if (!event.event_id) {
        anomalies.push({
          severity: "error",
          reason_code: "BAD_EVENT_FORMAT",
          event_id: "",
          message: "Missing event ID",
        });

        continue;
      }

      // -------------------------------------------------
      // DUPLICATE EVENT ID
      // -------------------------------------------------

      if (seenEventIds.has(event.event_id)) {
        anomalies.push({
          severity: "error",
          reason_code: "BAD_EVENT_FORMAT",
          event_id: event.event_id,
          message: "Duplicate event ID",
        });

        continue;
      }

      // Mark ID as seen
      seenEventIds.add(event.event_id);

      // -------------------------------------------------
      // TIMESTAMP VALIDATION
      // -------------------------------------------------

      const parsedDate = new Date(event.timestamp);

      if (isNaN(parsedDate.getTime())) {
        anomalies.push({
          severity: "error",
          reason_code: "BAD_EVENT_FORMAT",
          event_id: event.event_id,
          message: "Malformed timestamp",
        });

        continue;
      }

      // Store parsed timestamp
      event.parsedTimestamp = parsedDate;

      // Store valid event
      validEvents.push(event);
    }

    // =====================================================
    // SORT EVENTS CHRONOLOGICALLY
    // =====================================================

    validEvents.sort((a, b) => {
      // Sort by timestamp first
      const timeDifference = a.parsedTimestamp - b.parsedTimestamp;

      if (timeDifference !== 0) {
        return timeDifference;
      }

      // Tie-break by event_id
      return a.event_id.localeCompare(b.event_id);
    });

    // =====================================================
    // PROCESS EVENTS
    // =====================================================

    for (const event of validEvents) {
      // -------------------------------------------------
      // CHECKOUT EVENTS
      // -------------------------------------------------

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

    // =====================================================
    // DEBUG OUTPUT
    // =====================================================

    console.log("========== SUMMARY ==========");

    console.log("Inventory items:", inventory.length);

    console.log("Raw events:", events.length);

    console.log("Valid events:", validEvents.length);

    console.log("Anomalies found:", anomalies.length);

    console.log("========== FIRST VALID EVENT ==========");

    console.log(validEvents[0]);

    console.log("========== SAMPLE ITEM ==========");

    console.log(items.get("cam-001"));

    console.log("========== STUDENT ACTIVE ITEMS ==========");

    console.log(studentActiveItems);

    console.log("========== ANOMALIES ==========");

    console.log(anomalies);
  } catch (error) {
    console.error("Error loading files:");

    console.error(error);
  }
}
function processReturn(event, items, anomalies, studentActiveItems, policy) {
  // Find item
  const item = items.get(event.item_id);

  // =====================================================
  // UNKNOWN ITEM
  // =====================================================

  if (!item) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_ITEM",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item does not exist",
    });

    return;
  }

  // =====================================================
  // ITEM MUST BE CHECKED OUT
  // =====================================================

  if (item.status !== "checked_out") {
    anomalies.push({
      severity: "error",
      reason_code: "RETURN_NOT_ALLOWED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item is not checked out",
    });

    return;
  }

  // =====================================================
  // ACTOR MUST MATCH HOLDER
  // =====================================================

  if (item.holder !== event.actor_id) {
    anomalies.push({
      severity: "error",
      reason_code: "RETURN_NOT_ALLOWED",
      event_id: event.event_id,
      actor_id: event.actor_id,
      item_id: event.item_id,
      message: "Actor is not current holder",
    });

    return;
  }

  // =====================================================
  // CONDITION HANDLING
  // =====================================================

  const oldCondition = item.condition;

  const newCondition = event.condition_report;

  const conditionRanks = policy.condition_rank;

  const oldRank = conditionRanks[oldCondition];

  const newRank = conditionRanks[newCondition];

  // UNKNOWN CONDITION
  if (newCondition && newRank === undefined) {
    anomalies.push({
      severity: "warning",
      reason_code: "CONDITION_WORSENED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Unknown condition reported",
    });
  }

  // CONDITION WORSENED
  else if (newRank > oldRank) {
    anomalies.push({
      severity: "warning",
      reason_code: "CONDITION_WORSENED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Condition worsened",
    });

    item.condition = newCondition;
  }

  // STUDENT TRIES TO IMPROVE CONDITION
  else if (newRank < oldRank) {
    anomalies.push({
      severity: "warning",
      reason_code: "CONDITION_WORSENED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Student cannot improve condition",
    });

    // Keep old condition
  }

  // SAME CONDITION
  else if (newRank === oldRank) {
    item.condition = newCondition;
  }

  // =====================================================
  // AUTO MAINTENANCE
  // =====================================================

  const finalRank = conditionRanks[item.condition];

  if (finalRank >= policy.auto_maintenance_condition_rank) {
    item.status = "maintenance";
  } else {
    item.status = "available";
  }

  // =====================================================
  // CLEAR HOLDER + DUE DATE
  // =====================================================

  item.holder = null;

  item.due = null;

  // =====================================================
  // UPDATE STUDENT ACTIVE COUNT
  // =====================================================

  const currentCount = studentActiveItems.get(event.actor_id) || 0;

  studentActiveItems.set(event.actor_id, Math.max(0, currentCount - 1));
}
function processStaffReturn(
  event,
  items,
  anomalies,
  studentActiveItems,
  policy,
) {
  // Find item
  const item = items.get(event.item_id);

  // =====================================================
  // UNKNOWN ITEM
  // =====================================================

  if (!item) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_ITEM",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item does not exist",
    });

    return;
  }

  // =====================================================
  // ACTOR MUST BE STAFF
  // =====================================================

  if (!event.actor_id.startsWith("staff")) {
    anomalies.push({
      severity: "error",
      reason_code: "ACTOR_NOT_STAFF",
      event_id: event.event_id,
      actor_id: event.actor_id,
      message: "STAFF_RETURN requires staff actor",
    });

    return;
  }

  // =====================================================
  // ITEM MUST BE CHECKED OUT
  // =====================================================

  if (item.status !== "checked_out") {
    anomalies.push({
      severity: "error",
      reason_code: "RETURN_NOT_ALLOWED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item is not checked out",
    });

    return;
  }

  // =====================================================
  // STAFF RETURN WARNING
  // =====================================================

  anomalies.push({
    severity: "warning",
    reason_code: "STAFF_RETURN_USED",
    event_id: event.event_id,
    item_id: event.item_id,
    message: "Staff returned item on behalf of student",
  });

  // =====================================================
  // CONDITION HANDLING
  // =====================================================

  const oldCondition = item.condition;

  const newCondition = event.condition_report;

  const conditionRanks = policy.condition_rank;

  const oldRank = conditionRanks[oldCondition];

  const newRank = conditionRanks[newCondition];

  // CONDITION WORSENED
  if (newRank > oldRank) {
    anomalies.push({
      severity: "warning",
      reason_code: "CONDITION_WORSENED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Condition worsened",
    });

    item.condition = newCondition;
  }

  // STAFF CAN IMPROVE CONDITION
  else if (newRank < oldRank) {
    item.condition = newCondition;
  }

  // SAME CONDITION
  else {
    item.condition = newCondition;
  }

  // =====================================================
  // AUTO MAINTENANCE
  // =====================================================

  const finalRank = conditionRanks[item.condition];

  if (finalRank >= policy.auto_maintenance_condition_rank) {
    item.status = "maintenance";
  } else {
    item.status = "available";
  }

  // =====================================================
  // UPDATE STUDENT COUNT
  // =====================================================

  const currentHolder = item.holder;

  const currentCount = studentActiveItems.get(currentHolder) || 0;

  studentActiveItems.set(currentHolder, Math.max(0, currentCount - 1));

  // =====================================================
  // CLEAR HOLDER + DUE DATE
  // =====================================================

  item.holder = null;

  item.due = null;
}
function processMarkMaintenance(event, items, anomalies) {
  const item = items.get(event.item_id);

  // =====================================================
  // UNKNOWN ITEM
  // =====================================================

  if (!item) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_ITEM",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item does not exist",
    });

    return;
  }

  // =====================================================
  // ACTOR MUST BE STAFF
  // =====================================================

  if (!event.actor_id.startsWith("staff")) {
    anomalies.push({
      severity: "error",
      reason_code: "ACTOR_NOT_STAFF",
      event_id: event.event_id,
      actor_id: event.actor_id,
      message: "MARK_MAINTENANCE requires staff actor",
    });

    return;
  }

  // =====================================================
  // CANNOT MAINTAIN CHECKED OUT ITEM
  // =====================================================

  if (item.status === "checked_out") {
    anomalies.push({
      severity: "error",
      reason_code: "MAINTENANCE_NOT_ALLOWED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Checked out item cannot enter maintenance",
    });

    return;
  }

  // =====================================================
  // UPDATE STATUS
  // =====================================================

  item.status = "maintenance";
}
function processRestore(event, items, anomalies) {
  const item = items.get(event.item_id);

  // =====================================================
  // UNKNOWN ITEM
  // =====================================================

  if (!item) {
    anomalies.push({
      severity: "error",
      reason_code: "UNKNOWN_ITEM",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item does not exist",
    });

    return;
  }

  // =====================================================
  // ACTOR MUST BE STAFF
  // =====================================================

  if (!event.actor_id.startsWith("staff")) {
    anomalies.push({
      severity: "error",
      reason_code: "ACTOR_NOT_STAFF",
      event_id: event.event_id,
      actor_id: event.actor_id,
      message: "RESTORE requires staff actor",
    });

    return;
  }

  // =====================================================
  // ITEM MUST BE IN MAINTENANCE
  // =====================================================

  if (item.status !== "maintenance") {
    anomalies.push({
      severity: "error",
      reason_code: "RESTORE_NOT_ALLOWED",
      event_id: event.event_id,
      item_id: event.item_id,
      message: "Item is not in maintenance",
    });

    return;
  }

  // =====================================================
  // RESTORE ITEM
  // =====================================================

  item.status = "available";
}
main();
// await readCSV(...)
// wait until CSV finishes loading
// THEN continue
// Because reading files is asynchronous.
// Thats why we use async/await or promises.
// validating inventory checks for:
// missing holder
// missing due
// inconsistent states
