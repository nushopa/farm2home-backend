const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const Distributor = require("../models/Distributor");

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL, 
      scope:        ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email         = profile.emails?.[0]?.value;
        const firstName     = profile.name?.givenName;
        const lastName      = profile.name?.familyName;
        const profilePicture = profile.photos?.[0]?.value;
        const providerId    = profile.id;

        if (!email) {
          return done(new Error("No email returned from Google."), null);
        }

        // Check if distributor already exists by providerId or email
        let distributor = await Distributor.findOne({
          $or: [{ providerId }, { email }],
        });

        if (distributor) {
          // Existing user — update provider info if they previously used email
          if (distributor.authProvider === "email") {
            distributor.authProvider = "google";
            distributor.providerId   = providerId;
            await distributor.save();
          }
          return done(null, distributor);
        }

        // New user — create a partial account (profile completion required)
        distributor = await Distributor.create({
          firstName,
          lastName,
          email,
          password:          null,
          profilePicture,
          authProvider:      "google",
          providerId,
          isProfileComplete: false,
        });

        return done(null, distributor);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

/**
 * Facebook OAuth Strategy
 */
passport.use(
  new FacebookStrategy(
    {
      clientID:     process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:  process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "emails", "name", "photos"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email          = profile.emails?.[0]?.value;
        const firstName      = profile.name?.givenName  || "";
        const lastName       = profile.name?.familyName || "";
        const profilePicture = profile.photos?.[0]?.value || "";
        const providerId     = profile.id;

        if (!email) {
          return done(new Error("No email returned from Facebook. Please ensure your Facebook account has a verified email."), null);
        }

        let distributor = await Distributor.findOne({
          $or: [{ providerId }, { email }],
        });

        if (distributor) {
          if (distributor.authProvider === "email") {
            distributor.authProvider = "facebook";
            distributor.providerId   = providerId;
            await distributor.save();
          }
          return done(null, distributor);
        }

        distributor = await Distributor.create({
          firstName,
          lastName,
          email,
          password:          null,
          profilePicture,
          authProvider:      "facebook",
          providerId,
          isProfileComplete: false,
        });

        return done(null, distributor);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize/deserialize only used if you use sessions (we use JWT so these are minimal)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await Distributor.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;