const Cart = require("../models/Cart");

module.exports.addToCart = async (req, res, next) => {
  try {
    // get the user and the product ID
    const { product_id, customer_id } = req.body;
    if (!product_id || !customer_id)
      return res
        .status(400)
        .send({ message: "Customer or product ID is required" });

    // Check if the product already exists in the cart for the customer
    const existingCartItem = await Cart.findOne({ product_id, customer_id });
    if (existingCartItem) {
      return res
        .status(400)
        .send({ message: "Product already exists in the cart" });
    } else {
      // Save to cart
      const cartItem = await Cart.create({
        product_id,
        customer_id,
      });

      // Populate product details
      const result = await cartItem.populate("product_id");
      return res.status(200).send({ product: result });
    }
  } catch (error) {
    next(error);
  }
};
module.exports.getSingleCart = async (req, res, next) => {
  try {
    const cart = await Cart.find({ customer_id: req.params.id }).populate(
      "product_id"
    );
    return res.status(200).send({ cart });
  } catch (error) {
    next(error);
  }
};

// increamenet
module.exports.addToQuatity = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id);

    if (cart) {
      cart.product_quatity += 1;
      await cart.save();
      return res.status(200).send({ cart: cart._id });
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};

// decrement
module.exports.minusToQuatity = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id);

    if (cart) {
      if (cart.product_quatity !== 1) {
        cart.product_quatity -= 1;
        await cart.save();
        return res.status(200).send(cart._id);
      } else {
        await Cart.findByIdAndDelete(cart._id)
          .then((data) => {
            return res.status(200).send({ cart: data._id });
          })
          .catch((error) => {
            return res
              .status(400)
              .send({ message: "An error occured please try again later" });
          });
      }
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};

// delete cart
module.exports.deleteFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id);

    if (cart) {
      await Cart.findByIdAndDelete(cart._id)
        .then((data) => {
          return res.status(200).send({ cart: data._id });
        })
        .catch((error) => {
          return res
            .status(400)
            .send({ message: "An error occured please try again later" });
        });
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};
