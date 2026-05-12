const { Router } = require("express");
const { saveConsent } = require("../controllers/consentController");

const ConsentRoute = () => {
  const router = Router();  
    router.post("/", saveConsent);
    return router;
}

module.exports = ConsentRoute;