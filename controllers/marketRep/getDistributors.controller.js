const Distributor = require("../../models/Distributor");

// Fields that must never be returned to any API client
const HIDDEN_FIELDS = "-password -proofOfIdentity -__v";

// ─── List all distributors (admin only) ───────────────────────────────────────
async function getAllDistributors(req, res, next) {
  try {
    // req.user is populated by authMiddleware applied at the router level.
    // Role 2001 = regular distributor; anything else is treated as admin.
    if (req.user?.role === 2001) {
      return res.status(403).json({ message: "You are not authorised to access this resource." });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);  // cap at 100
    const skip  = (page - 1) * limit;

    const [distributors, totalItems] = await Promise.all([
      Distributor.find()
        .select(HIDDEN_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Distributor.countDocuments(),
    ]);

    return res.status(200).json({
      success:     true,
      data:        distributors,
      currentPage: page,
      totalPages:  Math.ceil(totalItems / limit),
      totalItems,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get a single distributor by ID ───────────────────────────────────────────
async function getDistributorById(req, res, next) {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id)
      .select(HIDDEN_FIELDS)
      .lean();

    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor not found." });
    }

    return res.status(200).json({ success: true, data: distributor });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAllDistributors, getDistributorById };