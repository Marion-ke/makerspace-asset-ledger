// Check if timestamp is valid
function isValidDate(date) {
  return !isNaN(date.getTime());
}

// Check if actor is student
function isStudent(actorId) {
  return actorId.startsWith("s");
}

// Check if actor is staff
function isStaff(actorId) {
  return actorId.startsWith("staff");
}

module.exports = {
  isValidDate,
  isStudent,
  isStaff,
};
