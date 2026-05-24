// Create internal item object
function createItem(row) {
  return {
    item_id: row.item_id,

    item_type: row.item_type,

    condition: row.condition,

    status: row.start_status,

    holder: row.start_holder || null,

    due: row.start_due || null,
  };
}

module.exports = {
  createItem,
};
