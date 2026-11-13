const Customer = require("../../models/Customer");
const Product = require("../../models/Product");

function formatNaira(amount) {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

function formatAddress(address = {}) {
  return [
    address.address,
    address.city,
    address.state,
    address.postal_code || address.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

async function buildOrderEmailDetails(order) {
  const productIds = order.products.map(
    (item) => item.product_id?._id ?? item.product_id,
  );
  const customerQuery = order.customer_id
    ? Customer.findById(order.customer_id)
        .select("_id email first_name last_name phone_number")
        .lean()
    : Promise.resolve(null);
  const productsQuery = Product.find({ _id: { $in: productIds } })
    .select("product_name product_price")
    .lean();
  const [customer, products] = await Promise.all([
    customerQuery,
    productsQuery,
  ]);
  const productsById = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const items = order.products.map((item) => {
    const productId = item.product_id?._id ?? item.product_id;
    const product = productsById.get(String(productId));
    const quantity = Number.parseInt(item.product_quatity, 10) || 0;
    const snapshotPrice = Number(item.unit_price);
    const price = Number.isFinite(snapshotPrice)
      ? snapshotPrice
      : Number(product?.product_price) || 0;

    return {
      name: item.product_name || product?.product_name || "Item",
      quantity,
      price,
      lineTotal: price * quantity,
    };
  });
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const deliveryFee = Number(order.delivery_fee) || 0;
  const amountPaid = Number(order.amount_paid) || 0;

  return {
    customer,
    items,
    subtotal,
    deliveryFee,
    amountPaid,
    serviceFee: Math.max(amountPaid - subtotal - deliveryFee, 0),
    deliveryMode: order.delivery_mode || "standard",
    deliveryAddress: formatAddress(order.address),
  };
}

module.exports = { buildOrderEmailDetails, formatAddress, formatNaira };
