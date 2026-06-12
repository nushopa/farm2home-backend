const Market = require("../models/Market");
const Distributor = require("../models/Distributor");
const { authMiddleware } = require("../middleware/authMiddleware");

async function addMarket(req, res, next) {
  const marketData = req.body;
  const { name, city } = marketData; // Extract name and city from market data
  try {
    // Check if a market with the same name and city already exists
    const existingMarket = await Market.findOne({ name, city });
    if (existingMarket) {
      return res.status(400).json({
        success: false,
        message: "Market already exists in this city",
      });
    }

    // If the market doesn't exist, create a new one
    const newMarket = await Market.create(marketData);
    res.status(201).json({ success: true, data: newMarket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to add market" });
  }
}

async function getAllMarkets(req, res, next) {
  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
      if (role === 2001)
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      const { page = 1, limit = 20 } = req.query; // Default to page 1 and limit of 20
      const skip = (page - 1) * limit; // Calculate the number of items to skip

      const markets = await Market.find()
        .populate("distributors")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Market.countDocuments();

      return res.status(200).send({
        success: true,
        data: markets,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch markets" });
  }
}


async function deleteMarket(req, res, next) {
  const { id } = req.params;
  try {
    // Find the market by ID and delete it
    const market = await Market.findByIdAndDelete(id);
    if (!market) {
      return res
        .status(404)
        .json({ success: false, message: "Market not found" });
    }
    // Remove the market from associated distributors
    await Distributor.updateMany({ markets: id }, { $pull: { markets: id } });
    res.status(200).json({
      success: true,
      data: market,
      message: "Market deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete market" });
  }
}

async function editMarket(req, res, next) {
  const { id, ...marketData } = req.body;
  try {
    const updatedMarket = await Market.findByIdAndUpdate(id, marketData, {
      new: true,
    });
    if (!updatedMarket) {
      return res
        .status(404)
        .json({ success: false, message: "Market not found" });
    }
    res.status(200).json({ success: true, data: updatedMarket });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update market" });
  }
}


async function getMarketById(req, res, next) {
  const { id } = req.params;
  try {
    const market = await Market.findById(id);
    if (!market) {
      return res
        .status(404)
        .json({ success: false, message: "Market not found" });
    }
    res.status(200).json({ success: true, data: market });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch market" });
  }
}


module.exports = {
  addMarket,
  getAllMarkets,
  deleteMarket,
  editMarket,
  getMarketById,
};
