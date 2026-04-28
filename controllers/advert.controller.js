const Advert = require("../models/Advert");
const cloud = require("../config/cloud");

async function uploadAdvert(req, res) {
  try {
    const result = await cloud(req.file.path);

    if (!result || !result.secure_url) {
      return res.status(500).json({ error: "Error uploading advert to Cloudinary" });
    }

    const advert = new Advert({
      imageUrl: result.secure_url,
      title: req.body.title,
    });
    await advert.save();
    return res.status(200).json({ 
        message: "Advert uploaded successfully", 
        advert 
    });

} catch (error) {
    res.status(500).json({ error: "Error uploading advert" });
  }
}

async function getAdverts(req, res) {
  try {
    const adverts = await Advert.find().sort({ createdAt: -1 });
    res.status(200).json(adverts);
  } catch (error) {
    res.status(500).json({ error: "Error fetching adverts" });
  }
}

module.exports = { uploadAdvert, getAdverts };
