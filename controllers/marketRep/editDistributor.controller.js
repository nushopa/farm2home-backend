const Distributor = require("../../models/Distributor");

// Fields that callers must never be able to overwrite through an edit endpoint
const PROTECTED_FIELDS = new Set([
  "_id", "id", "email", "password", "authProvider", "__v",
]);

// ─── Edit general distributor fields ─────────────────────────────────────────
async function editDistributor(req, res, next) {
  try {
    const { id } = req.params;

    // Strip every protected field from the incoming payload
    const distributorData = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => !PROTECTED_FIELDS.has(key))
    );

    if (Object.keys(distributorData).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided for update." });
    }

    const updatedDistributor = await Distributor.findByIdAndUpdate(
      id,
      { $set: distributorData },
      { new: true, runValidators: true }
    ).select("-password -proofOfIdentity -__v");

    if (!updatedDistributor) {
      return res.status(404).json({ success: false, message: "Distributor not found." });
    }

    return res.status(200).json({ success: true, data: updatedDistributor });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Phone number already in use." });
    }
    next(error);
  }
}

// ─── Update review / approval status ─────────────────────────────────────────
async function updateDistributorReviewStatus(req, res, next) {
  try {
    const { id }     = req.params;
    const { review } = req.body;

    if (typeof review !== "boolean") {
      return res.status(400).json({ message: "review must be a boolean." });
    }

    // Atomic single write — eliminates the read-modify-write race condition
    const distributor = await Distributor.findByIdAndUpdate(
      id,
      {
        review,
        status: review === true,   // true = verified, false = under review
      },
      { new: true, runValidators: true }
    ).select("-password -proofOfIdentity -__v");

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found." });
    }

    return res.status(200).json({
      message:      `Distributor status updated to "${review ? "verified" : "under review"}".`,
      distributor,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { editDistributor, updateDistributorReviewStatus };