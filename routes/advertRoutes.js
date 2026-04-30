const { Router } = require("express");
const { 
  uploadAdvert,
  getAdverts,
  editAdvert,
  deleteAdvert  
} = require("../controllers/advert.controller");
const upload = require("../middleware/upload"); 

const AdvertRoute = () => {
  const router = Router();

  router.post("/", upload.single("file"), uploadAdvert);
  router.get("/", getAdverts);
  router.put("/:id", upload.single("file"), editAdvert);
  router.delete("/:id", deleteAdvert);

  return router;
}

module.exports = AdvertRoute;