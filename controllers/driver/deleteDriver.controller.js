const Driver = require("../../models/Driver");

module.exports.deleteDriver = async (req, res, next) => {
    const { id } = req.params;
  
    try {
      // Find and delete the driver by ID
      const driver = await Driver.findByIdAndDelete(id);
  
      if (!driver) {
        return res.status(404).send({ message: "Driver not found!" });
      }
  
      res.status(200).send({ message: "Driver deleted successfully!" });
    } catch (error) {
      next(error);
    }
  };
  
  