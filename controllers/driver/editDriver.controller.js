const Driver = require("../../models/Driver");
const { notifyUser } = require("../../lib/util/deliverNotification");

const sanitizeDriver = (driver) => {
  const obj = driver.toObject();
  delete obj.password;
  return obj;
};

module.exports.editDriver = async (req, res, next) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    address,
    workCity,
    vehicleType,
    proofOfIdentity,
    licenseFile,
    status,
    profilePicture,
    availability,
  } = req.body;

  try {
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    // Status can only be toggled once the driver has been reviewed
    if (status !== undefined && !driver.review) {
      return res.status(400).send({
        message: "Status cannot be updated unless the review is true!",
      });
    }

    if (availability !== undefined && typeof availability !== "boolean") {
      return res
        .status(400)
        .send({ message: "Availability must be true or false" });
    }

    driver.firstName = firstName || driver.firstName;
    driver.lastName = lastName || driver.lastName;
    driver.email = email || driver.email;
    driver.phoneNumber = phoneNumber || driver.phoneNumber;
    driver.dateOfBirth = dateOfBirth || driver.dateOfBirth;
    driver.address = address || driver.address;
    driver.workCity = workCity || driver.workCity;
    driver.vehicleType = vehicleType || driver.vehicleType;
    driver.proofOfIdentity = proofOfIdentity || driver.proofOfIdentity;
    driver.licenseFile = licenseFile || driver.licenseFile;
    driver.profilePicture = profilePicture || driver.profilePicture;
    driver.status = status !== undefined ? status : driver.status;

    if (availability !== undefined) {
      driver.availability = availability;
    }

    await driver.save();

    res.status(200).send({
      message: "Driver information updated successfully!",
      driver: sanitizeDriver(driver),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.updateDriverReviewStatus = async (io, req, res, next) => {
  const { id } = req.params;
  const { review } = req.body;

  try {
    if (typeof review !== "boolean") {
      return res
        .status(400)
        .send({ message: "Review must be true or false" });
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    driver.review = review;
    await driver.save();

    await notifyUser(io, driver, {
      userModel: "Drivers",
      category: "onboarding_status",
      title: review ? "Rider onboarding approved" : "Rider onboarding review updated",
      message: review
        ? "Your rider account has been approved."
        : "Your rider application is still under review.",
      metadata: { review, status: review ? "approved" : "pending" },
      channels: ["push", "email"],
    });

    res.status(200).send({
      message: `Driver review status updated successfully to ${
        review ? "verified" : "under review or suspended"
      }!`,
      driver: sanitizeDriver(driver),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle a driver's availability (online/offline).
 * Protect this route with your auth middleware.
 */
module.exports.updateDriverAvailability = async (req, res, next) => {
  const { id } = req.params;
  const { availability } = req.body;

  try {
    if (typeof availability !== "boolean") {
      return res
        .status(400)
        .send({ message: "Availability must be true or false" });
    }

    // A driver may only change their own availability.
    // req.driverId is set by driverAuthMiddleware from the JWT.
    if (!req.driverId) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    if (String(req.driverId) !== String(id)) {
      return res.status(403).send({
        message: "You can only update your own availability",
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      id,
      { availability },
      { returnDocument: "after" }
    ).select("-password");

    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    res.status(200).send({
      message: `Driver is now ${availability ? "available" : "unavailable"}`,
      driver,
    });
  } catch (error) {
    next(error);
  }
};