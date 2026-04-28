const Driver = require("../../models/Driver");

module.exports.editDriver = async (req, res, next) => {
  const { id } = req.params;
  const {
    fullName,
    email,
    phoneNumber,
    dateOfBirth,
    homeAddress,
    licenseNumber,
    licenseClass,
    issuingState,
    expirationDate,
    vehicleType,
    licensePlate,
    licenseFile,
    pastExperience,
    status,
    profilePicture,
  } = req.body;

  try {
    // Check if the driver exists
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    // Restrict toggling status if review is false
    if (status !== undefined && !driver.review) {
      return res
        .status(400)
        .send({ message: "Status cannot be updated unless the review is true!" });
    }

    // Update the driver information except the password
    driver.fullName = fullName || driver.fullName;
    driver.email = email || driver.email;
    driver.phoneNumber = phoneNumber || driver.phoneNumber;
    driver.dateOfBirth = dateOfBirth || driver.dateOfBirth;
    driver.homeAddress = homeAddress || driver.homeAddress;
    driver.licenseNumber = licenseNumber || driver.licenseNumber;
    driver.licenseClass = licenseClass || driver.licenseClass;
    driver.issuingState = issuingState || driver.issuingState;
    driver.expirationDate = expirationDate || driver.expirationDate;
    driver.vehicleType = vehicleType || driver.vehicleType;
    driver.licensePlate = licensePlate || driver.licensePlate;
    driver.licenseFile = licenseFile || driver.licenseFile;
    driver.pastExperience = pastExperience || driver.pastExperience;
    driver.status = status !== undefined ? status : driver.status;
    driver.profilePicture = profilePicture || driver.profilePicture;

    // Save the updated driver information
    await driver.save();

    res.status(200).send({
      message: "Driver information updated successfully!",
      driver,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.updateDriverReviewStatus = async (req, res, next) => {
    const { id } = req.params; // Driver ID from URL params
    const { review } = req.body; // Review status from request body
  
    try {
      // Check if the driver exists
      const driver = await Driver.findById(id);
      if (!driver) {
        return res.status(404).send({ message: "Driver not found!" });
      }
  
      // Update the review status
      driver.review = review;
  
      // Save the changes to the database
      await driver.save();
  
      res.status(200).send({
        message: `Driver review status updated successfully to ${review ? "verified" : "under review or suspended"}!`,
        driver,
      });
    } catch (error) {
      next(error);
    }
  };
  