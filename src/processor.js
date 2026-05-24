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
module.exports = {
  processCheckout,
  processReturn,
  processStaffReturn,
  processMarkMaintenance,
  processRestore,
};
