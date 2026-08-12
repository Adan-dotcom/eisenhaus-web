const { checkCoverage } = require("./lib/delivery");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const city = String(req.body?.city || "").trim();
  if (!city) {
    return res.status(400).json({ error: "Missing city" });
  }
  return res.status(200).json(checkCoverage(city));
};
