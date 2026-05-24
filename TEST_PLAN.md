# Test Plan

## Goal

Verify that the Makerspace Asset Ledger system correctly:

- validates inventory
- validates events
- processes all event types
- tracks item states
- tracks student active item counts
- records anomalies
- generates output reports

---

# Test Cases

| Test Case                              | Expected Result                                            |
| -------------------------------------- | ---------------------------------------------------------- |
| Duplicate event ID                     | BAD_EVENT_FORMAT anomaly generated                         |
| Malformed timestamp                    | BAD_EVENT_FORMAT anomaly generated                         |
| Unknown item checkout                  | UNKNOWN_ITEM anomaly generated                             |
| Checkout unavailable item              | ITEM_NOT_AVAILABLE anomaly generated                       |
| Student exceeds item limit             | ITEM_LIMIT_REACHED anomaly generated                       |
| Missing loan policy                    | UNKNOWN_LOAN_POLICY anomaly generated                      |
| Return item not checked out            | RETURN_NOT_ALLOWED anomaly generated                       |
| Student attempts condition improvement | CONDITION_WORSENED warning generated                       |
| Staff return processing                | STAFF_RETURN_USED warning generated                        |
| Damaged return                         | Item automatically enters maintenance                      |
| Restore maintenance item               | Item becomes available                                     |
| Chronological sorting                  | Earlier timestamps processed first regardless of CSV order |

---

# Manual Verification

Verified:

- final_state.csv generated correctly
- anomalies.csv generated correctly
- student_summary.csv generated correctly
- run_summary.md generated correctly

---

# Edge Cases Verified

- Invalid inventory rows
- Duplicate events
- Malformed timestamps
- Unknown condition reports
- Unknown item references
- Maintenance transitions
- Restore transitions
- Empty holder values
