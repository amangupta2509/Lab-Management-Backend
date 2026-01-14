const { OAuth2Client } = require("google-auth-library");

/**
 * Mobile-Only Google OAuth Configuration
 * This replaces Passport.js for mobile applications
 */

// Initialize OAuth2Client once (reused for all requests)
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token from mobile app
 * @param {string} idToken - ID token from Google Sign-In
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyGoogleToken(idToken) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    return {
      success: true,
      data: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
      },
    };
  } catch (error) {
    console.error("Google token verification failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Validate that required Google OAuth environment variables exist
 */
function validateGoogleConfig() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is required for mobile OAuth");
  }

  console.log("Google OAuth (Mobile) configured successfully");
  console.log(
    `   Client ID: ${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`
  );
}

module.exports = {
  googleClient,
  verifyGoogleToken,
  validateGoogleConfig,
};
