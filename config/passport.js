const passport         = require("passport");
const GoogleStrategy   = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const fs               = require("fs");
const Customer         = require("../models/Customer");

// ─── Reusable: find or create any customer ───────────────────────────────────
const findOrCreateUser = async ({ email, firstName, lastName, profilePicture, providerId, authProvider }) => {
  if (!providerId) throw new Error(`Could not get ${authProvider} user ID.`);

  let customer = await Customer.findOne({
    $or: [
      { provider_id: providerId },
      ...(email ? [{ email }] : []),
    ],
  });

  if (customer) {
    // If they previously registered with email, link their OAuth provider
    if (customer.auth_provider === "email") {
      customer.auth_provider = authProvider;
      customer.provider_id   = providerId;
      if (profilePicture && !customer.profile_picture) {
        customer.profile_picture = profilePicture;
      }
      await customer.save();
    }
    return customer;
  }

  // New customer — create with default role 2001
  customer = await Customer.create({
    first_name:      firstName,
    last_name:       lastName,
    email:           email || null,
    password:        null,
    profile_picture: profilePicture || null,
    auth_provider:   authProvider,
    provider_id:     providerId,
    role:            2001,
  });

  return customer;
};

// ─── Google ───────────────────────────────────────────────────────────────────
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
        const customer = await findOrCreateUser({
          email:          profile.emails?.[0]?.value,
          firstName:      profile.name?.givenName  || "",
          lastName:       profile.name?.familyName || "",
          profilePicture: profile.photos?.[0]?.value || null,
          providerId:     profile.id,
          authProvider:   "google",
        });
        return done(null, customer);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// ─── Facebook ─────────────────────────────────────────────────────────────────
passport.use(
  new FacebookStrategy(
    {
      clientID:      process.env.FACEBOOK_APP_ID,
      clientSecret:  process.env.FACEBOOK_APP_SECRET,
      callbackURL:   process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "emails", "name", "picture.type(large)"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const customer = await findOrCreateUser({
          email:          profile.emails?.[0]?.value || null,
          firstName:      profile.name?.givenName  || "",
          lastName:       profile.name?.familyName || "",
          profilePicture: profile.photos?.[0]?.value || null,
          providerId:     profile.id,
          authProvider:   "facebook",
        });
        return done(null, customer);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);


// ─── Session (minimal — JWT-based, session: false used in routes) ─────────────
passport.serializeUser((customer, done)       => done(null, customer._id));
passport.deserializeUser(async (id, done) => {
  try {
    const customer = await Customer.findById(id);
    done(null, customer);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;