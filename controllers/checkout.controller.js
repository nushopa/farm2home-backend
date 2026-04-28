const CheckOut = require("../models/CheckOut");
const PriceList = require("../models/PriceList");
const Cart = require("../models/Cart");

async function addAdress(req, res, next) {
  const {
    first_name,
    address,
    last_name,
    email,
    customer_id,
    phone_number,
    state,
    city,
    additional_phone_number,
    directions,
  } = req.body;

  if (
    !first_name ||
    !address ||
    !last_name ||
    !customer_id ||
    !email ||
    !phone_number ||
    !state ||
    !city
  ) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  CheckOut.create({
    customer_id,
    address,
    directions,
    first_name,
    last_name,
    email,
    phone_number,
    state,
    city,
    additional_phone_number,
  })
    .then(() => {
      PriceList.findOne({ city })
        .then((data) => {
          const { estimatePrice, ...others } = data._doc;
          res.status(200).send({ estimatePrice });
        })
        .catch(() =>
          res
            .status(422)
            .send({ message: "An error occured please try again later!" })
        );
    })
    .catch(() =>
      res.status(400).send({ message: "An unknown error occured..." })
    );
}

async function addressBook(req, res, next) {
  const { id } = req.params;
  const checkouts = await CheckOut.find({ customer_id: id });
  const checkout = checkouts.map((p) => ({
    address: p.address,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone_number: p.phone_number,
    state: p.state,
    city: p.city,
    additional_phone_number: p.additional_phone_number,
    directions: p.directions,
    doc_id: p._id,
  }));

  return res.status(200).send({ checkout });
}

async function deleteAddress(req, res, next) {
  const { id } = req.params;

  try {
    const deletedAddress = await CheckOut.findByIdAndDelete(id);

    if (!deletedAddress) {
      return res.status(404).send({ message: "Address not found!" });
    }

    return res.status(200).send({ message: "Address deleted successfully!" });
  } catch (error) {
    return res
      .status(500)
      .send({ message: "An error occurred while deleting the address." });
  }
}

module.exports = { addAdress, addressBook, deleteAddress };
