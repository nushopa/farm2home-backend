const Advert = require("../models/Advert");
const cloud = require("../config/cloud");
const cloudinary = require("cloudinary").v2;

async function uploadAdvert(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    if (!req.body.title || req.body.title.trim() === "") {
      return res.status(400).json({ error: "Title is required" });
    }

    const result = await cloud(req.file.buffer);

    if (!result || !result.secure_url) {
      return res.status(500).json({ error: "Error uploading advert to Cloudinary" });
    }

    const advert = new Advert({
      imageUrl: result.secure_url,
      publicId: result.public_id, 
      title: req.body.title.trim(),
    });

    await advert.save();
    return res.status(200).json({ 
      message: "Advert uploaded successfully", 
      advert 
    });

  } catch (error) {
    console.error("uploadAdvert error:", error);
    res.status(500).json({ error: error.message || "Error uploading advert" });
  }
}

async function getAdverts(req, res) {
  try {
    const adverts = await Advert.find().sort({ createdAt: -1 });
    res.status(200).json(adverts);
  } catch (error) {
    console.error("getAdverts error:", error);
    res.status(500).json({ error: "Error fetching adverts" });
  }
}

async function editAdvert(req, res) {
  try {
    const { id } = req.params;
    const advert = await Advert.findById(id);

    if (!advert) {
      return res.status(404).json({ error: "Advert not found" });
    }

    if (req.body.title && req.body.title.trim() !== "") {
      advert.title = req.body.title.trim();
    }

    if (req.file) {
      // Delete old image from Cloudinary using saved public_id
      if (advert.publicId) {
        await cloudinary.uploader.destroy(advert.publicId);
      }

      // Upload new image from buffer
      const result = await cloud(req.file.buffer);
      if (!result || !result.secure_url) {
        return res.status(500).json({ error: "Error uploading new image to Cloudinary" });
      }

      advert.imageUrl = result.secure_url;
      advert.publicId = result.public_id;
    }

    await advert.save();
    return res.status(200).json({ 
      message: "Advert updated successfully", 
      advert 
    });

  } catch (error) {
    console.error("editAdvert error:", error);
    res.status(500).json({ error: "Error updating advert" });
  }
}

async function deleteAdvert(req, res) {
  try {
    const { id } = req.params;
    const advert = await Advert.findById(id);

    if (!advert) {
      return res.status(404).json({ error: "Advert not found" });
    }

    // Delete from Cloudinary using saved public_id
    if (advert.publicId) {
      await cloudinary.uploader.destroy(advert.publicId);
    }

    await Advert.findByIdAndDelete(id);
    return res.status(200).json({ message: "Advert deleted successfully" });

  } catch (error) {
    console.error("deleteAdvert error:", error);
    res.status(500).json({ error: "Error deleting advert" });
  }
}

module.exports = { 
  uploadAdvert,
  getAdverts,
  editAdvert,
  deleteAdvert 
};