const passport       = require("passport");
const GoogleStrategy  = require("passport-google-oauth20").Strategy;
const Customer        = require("../models/Customer");

const findOrCreateGoogleUser = async (profile) => {
  const providerId = profile.id;
  const emailObj   = profile.emails?.[0];
  const email      = emailObj?.value || null;
  
  const emailVerified = emailObj?.verified !== false;

  if (!providerId) {
    throw new Error("Could not get Google user ID.");
  }

  let customer = await Customer.findOne({
    provider_id: providerId,
    auth_provider: "google",
  });

  if (customer) {
    return customer;
  }

  if (email && emailVerified) {
    const existingByEmail = await Customer.findOne({ email });

    if (existingByEmail) {
      existingByEmail.auth_provider = "google";
      existingByEmail.provider_id   = providerId;

      if (profile.photos?.[0]?.value && !existingByEmail.profile_picture) {
        existingByEmail.profile_picture = profile.photos[0].value;
      }

      await existingByEmail.save();
      return existingByEmail;
    }
  }

  const newCustomer = await Customer.create({
    first_name:      profile.name?.givenName  || "",
    last_name:       profile.name?.familyName || "",
    email:           email,
    password:        null,
    profile_picture: profile.photos?.[0]?.value || null,
    auth_provider:   "google",
    provider_id:     providerId,
    role:            2001,
  });

  return newCustomer;
};

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.BACKEND_URL}/auth/google/callback`,
      scope:        ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const customer = await findOrCreateGoogleUser(profile);
        return done(null, customer);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);


passport.serializeUser((customer, done) => done(null, customer._id));
passport.deserializeUser(async (id, done) => {
  try {
    const customer = await Customer.findById(id);
    done(null, customer);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;