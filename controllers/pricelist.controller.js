const PriceList = require("../models/PriceList");

async function addPriceList(req, res, next) {
  try {
    const { city, estimatePrice } = req.body;

    if (
      typeof city !== "string" ||
      !city.trim() ||
      !Number.isFinite(estimatePrice) ||
      estimatePrice < 0
    ) {
      return res
        .status(422)
        .send({ message: "A city and a valid non-negative delivery price are required." });
    }

    const data = await PriceList.create({ city: city.trim(), estimatePrice });
    return res.status(201).send({ data });
  } catch (error) {
    next(error);
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
    const result = await PriceList.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).send({ message: "City not found." });
    }
    return res.status(200).send({ message: "Deleted!" });
  } catch (error) {
    next(error);
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
    next(error);
  }
}

async function editCity(req, res, next) {
  try {
    const { city, estimatePrice, id } = req.body;

    if (
      typeof id !== "string" ||
      !id ||
      typeof city !== "string" ||
      !city.trim() ||
      !Number.isFinite(estimatePrice) ||
      estimatePrice < 0
    ) {
      return res
        .status(422)
        .send({ message: "A city, id, and valid non-negative delivery price are required." });
    }

    const currentPricelist = await PriceList.findByIdAndUpdate(
      id,
      { city: city.trim(), estimatePrice },
      { new: true, runValidators: true }
    );
    if (!currentPricelist) {
      return res.status(404).send({ message: "City not found." });
    }
    return res
      .status(200)
      .send({
        message: "Price list updated successfully!",
        data: currentPricelist,
      });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addPriceList,
  getPriceList,
  deleteCity,
  editCity,
  getCityById,
};
