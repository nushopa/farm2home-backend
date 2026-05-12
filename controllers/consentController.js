const ConsentRecord = require("../models/ConsentRecord");

module.exports.saveConsent = async (req, res) => {
  try {
    const body = req.body;

    if (!body || !body.preferences || !body.timestamp || !body.version) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Use authenticated user ID if available, fall back to IP
    const userId = req.user?.id || req.user?.userId || req.ip;

    const record = {
      userId,
      preferences: {
        essential: true, // always on
        analytics: Boolean(body.preferences.analytics),
        marketing: Boolean(body.preferences.marketing),
      },
      timestamp: new Date(body.timestamp),
      version: body.version,
      userAgent: req.get("User-Agent") || null,
      ipAddress: req.ip || null,
    };

    await ConsentRecord.findOneAndUpdate({ userId }, record, {
      upsert: true,
      new: true,
    });

    return res.status(200).json({ message: "Consent saved successfully" });
  } catch (error) {
    console.error("Save consent error:", error);
    return res.status(500).json({ message: "Error saving consent" });
  }
};

module.exports.getConsent = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.ip;

    const record = await ConsentRecord.findOne({ userId });

    if (!record) {
      return res.status(404).json({ message: "No consent record found" });
    }

    return res.status(200).json({ consent: record });
  } catch (error) {
    console.error("Get consent error:", error);
    return res.status(500).json({ message: "Error retrieving consent" });
  }
};