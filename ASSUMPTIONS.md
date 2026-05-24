# Assumptions

## Event Processing

- Events are validated before processing.
- Invalid events are skipped and recorded as anomalies.
- Events are processed chronologically using timestamp sorting.
- If timestamps are identical, event_id is used as a tie-breaker.

---

## Inventory Validation

- Invalid inventory rows still remain in the system state.
- Inventory validation records anomalies but does not automatically repair corrupted data.

---

## Student Limits

- Initial checked_out inventory items count toward the student active item limit.
- Student active item counts cannot become negative.

---

## Condition Handling

- Condition worsening generates warnings.
- Students are not allowed to improve item condition during normal RETURN events.
- Staff members may improve condition during STAFF_RETURN events.
- Unknown condition reports generate warnings but do not stop processing.

---

## Maintenance Logic

- Items automatically enter maintenance when condition rank reaches the configured maintenance threshold.
- Checked out items cannot manually enter maintenance.
- RESTORE only works for items currently in maintenance.

---

## Missing Policies

- Missing loan policies generate anomalies and block checkout processing.

---

## Unknown Items

- Events referencing unknown items generate anomalies and are skipped.

---

## Reports

- Generated reports reflect the final processed system state after all valid events complete.
