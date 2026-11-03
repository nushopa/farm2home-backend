const { authMiddleware } = require("../../middleware/authMiddleware");
const Driver = require("../../models/Driver");

module.exports.getSingleDriver = async (req, res, next) => {
  const { id } = req.params;
  try {
    const driver = await Driver.findById(id).select("-password").lean();
    if (!driver) {
      return res.status(404).send({ message: "Driver not found" });
    }

    res.status(200).send(driver);
  } catch (err) {
    next(err);
  }
};

module.exports.getAllDrivers = async (req, res, next) => {
  const { page = 1, limit = 20, availability } = req.query;
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const limitNum = Math.max(parseInt(limit) || 20, 1);
  const skip = (pageNum - 1) * limitNum;

  try {
    authMiddleware(req, res, async () => {
      // Fixed: req.role is the role itself, not an object
      const role = req.role;
      if (role === 2001) {
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      }

      // Optional filter: /drivers?availability=true
      const filter = {};
      if (availability === "true") filter.availability = true;
      if (availability === "false") filter.availability = false;

      const drivers = await Driver.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      const totalItems = await Driver.countDocuments(filter);

      return res.status(200).send({
        driver: drivers,
        totalItems,
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
      });
    });
  } catch (error) {
    next(error);
  }
};