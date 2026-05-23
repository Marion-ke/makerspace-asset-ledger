const fs = require("fs");
const csv = require("csv-parser");

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function readJSON(filePath) {
  const rawData = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(rawData);
}

module.exports = {
  readCSV,
  readJSON,
};
// readCSV()
// opens CSV file
// converts rows into JavaScript objects
// returns array of rows
// [
//   {
//     item_id: "cam-001",
//     item_type: "camera"
//   }
// ]
// readJSON()
// reads policy.json
// converts JSON into JS object
