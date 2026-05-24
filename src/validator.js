const { isValidDate } = require("./helpers");
const { createItem } = require("./models");

// Validate inventory rows
function validateInventory(inventory, items, anomalies, studentActiveItems) {
  for (const row of inventory) {
    const isCheckedOut = row.start_status === "checked_out";

    const hasHolder = row.start_holder !== "";

    const hasDue = row.start_due !== "";

    // Bad checked_out row
    if (isCheckedOut && (!hasHolder || !hasDue)) {
      anomalies.push({
        severity: "error",
        reason_code: "BAD_INVENTORY_ROW",
        item_id: row.item_id,
        message: "Checked out item missing holder or due date",
      });
    }

    // Bad available/maintenance row
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

    // Store internal item state
    const item = createItem(row);

    items.set(row.item_id, item);
  }

  // Initialize student counts
  for (const item of items.values()) {
    if (item.status === "checked_out" && item.holder) {
      const currentCount = studentActiveItems.get(item.holder) || 0;

      studentActiveItems.set(item.holder, currentCount + 1);
    }
  }
}

// Validate event rows
function validateEvents(events, validEvents, anomalies) {
  const seenEventIds = new Set();

  for (const event of events) {
    // Missing event ID
    if (!event.event_id) {
      anomalies.push({
        severity: "error",
        reason_code: "BAD_EVENT_FORMAT",
        event_id: "",
        message: "Missing event ID",
      });

      continue;
    }

    // Duplicate event ID
    if (seenEventIds.has(event.event_id)) {
      anomalies.push({
        severity: "error",
        reason_code: "BAD_EVENT_FORMAT",
        event_id: event.event_id,
        message: "Duplicate event ID",
      });

      continue;
    }

    seenEventIds.add(event.event_id);

    // Timestamp validation
    const parsedDate = new Date(event.timestamp);

    if (!isValidDate(parsedDate)) {
      anomalies.push({
        severity: "error",
        reason_code: "BAD_EVENT_FORMAT",
        event_id: event.event_id,
        message: "Malformed timestamp",
      });

      continue;
    }

    event.parsedTimestamp = parsedDate;

    validEvents.push(event);
  }

  // Sort chronologically
  validEvents.sort((a, b) => {
    const timeDifference = a.parsedTimestamp - b.parsedTimestamp;

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return a.event_id.localeCompare(b.event_id);
  });
}

module.exports = {
  validateInventory,
  validateEvents,
};
