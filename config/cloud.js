const cloudinary = require("cloudinary");
const cloud = async (value) => {
  await cloudinary.v2.uploader
    .upload(value, { overwrite: true, invalidate: true, resource_type: "auto" })
    .then((result) => {
      return result;
    })
    .catch((error) => error);
};
module.exports = cloud;
