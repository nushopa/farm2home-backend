const { authMiddleware } = require("../../middleware/authMiddleware");
const Driver = require("../../models/Driver");

module.exports.getSingleDriver = async (req, res, next) => {
  const { id } = req.params;
  try {
    let driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({ message: "Driver not found" });
    }

    driver = driver.toObject();
    delete driver.password;
    res.status(200).send(driver);
  } catch (err) {
    next(err);
  }
};
module.exports.getAllDrivers = async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query; // Default to page 1 and limit of 20
  const skip = (page - 1) * limit; // Calculate the number of items to skip

  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
      if (role === 2001) {
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      }

      // Fetch drivers with pagination
      const drivers = await Driver.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Driver.countDocuments();

      // Remove password from each driver
      const sanitizedDrivers = drivers.map((driver) => {
        const driverObj = driver.toObject(); // Convert to plain object
        delete driverObj.password; // Remove the password field
        return driverObj; // Return sanitized driver object
      });

      return res.status(200).send({
        driver: sanitizedDrivers,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    });
  } catch (error) {
    next(error);
  }
};
