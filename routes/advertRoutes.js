const {Router} = require("express");
const { uploadAdvert, getAdverts } = require("../controllers/advert.controller");

const AdvertRoute = () => {
const router = Router();
router.post("/adverts", uploadAdvert);


router.get("/adverts", getAdverts);
return router;
}

module.exports = AdvertRoute;
