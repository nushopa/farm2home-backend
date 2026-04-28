const Distributor    = require("../../models/Distributor");
const Notification   = require("../../models/Notification");

// ─── Delete a distributor (admin only) ────────────────────────────────────────
async function deleteDistributor(req, res, next) {
  try {
    // Authorisation: only admins (role !== 2001) may delete accounts.
    // This guard is a defence-in-depth fallback; the router should also apply
    // an admin-only middleware so this endpoint is never reachable by role 2001.
    if (req.user?.role === 2001) {
      return res.status(403).json({ success: false, message: "You are not authorised to perform this action." });
    }

    const { id } = req.params;

    const distributor = await Distributor.findByIdAndDelete(id);

    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor not found." });
    }

    // Cascade: remove notifications that reference this distributor.
    // Extend this block for any other collections that hold a distributor FK.
    await Notification.deleteMany({ full_name: `${distributor.firstName} ${distributor.lastName}` });

    // Return only non-sensitive fields in the confirmation payload
    const { password: _, proofOfIdentity: __, __v: ___, ...safeData } =
      distributor.toObject();

    return res.status(200).json({
      success: true,
      message: "Distributor deleted successfully.",
      data:    safeData,
    });
  } catch (error) {
    // Delegate to the central error handler — no manual res.status(500) here
    next(error);
  }
}

module.exports = { deleteDistributor };