const PriceList = require("../models/PriceList");

async function addPriceList(req, res, next) {
  try {
    const { city, estimatePrice } = req.body;

    if (!city || !estimatePrice) {
      return res.status(422).send({ message: "All fields are required!" });
    }

    PriceList.create({ city, estimatePrice })
      .then((data) => res.status(201).send({ data }))
      .catch(() => res.status(500).send({ message: "An error occurred!" }));
  } catch (e) {
    next(e);
  }
}

async function getPriceList(req, res, next) {
  try {
    const prices = await PriceList.find();
    return res.status(200).send({ prices });
  } catch (e) {
    next(e);
  }
}

async function deleteCity(req, res, next) {
  try {
    let result = await PriceList.findByIdAndDelete(req.params.id);
    return res.status(200).send({ message: "Deleted!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete city" });
  }
}

async function getCityById(req, res, next) {
  try {
    const city = await PriceList.findById(req.params.id);
    if (!city) {
      return res.status(404).send({ message: "City not found" });
    }
    return res.status(200).send({ city });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to get city" });
  }
}

async function editCity(req, res, next) {
  try {
    const { city, estimatePrice, id } = req.body;

    if (!city || !estimatePrice) {
      return res.status(422).send({ message: "All fields are required!" });
    }

    let currentPricelist = await PriceList.findByIdAndUpdate(
      id,
      { city, estimatePrice },
      { new: true }
    );
    return res
      .status(200)
      .send({
        message: "Price list updated successfully!",
        data: currentPricelist,
      });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update price list" });
  }
}

module.exports = {
  addPriceList,
  getPriceList,
  deleteCity,
  editCity,
  getCityById,
};
