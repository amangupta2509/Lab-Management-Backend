const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { verifyGoogleToken } = require("../config/googleAuth");
const CONSTANTS = require("../config/constants");

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Validate email configuration
if (
  process.env.SMTP_HOST &&
  (!process.env.SMTP_USER || !process.env.SMTP_PASS)
) {
  console.warn("⚠️ SMTP_HOST is set but SMTP_USER or SMTP_PASS is missing");
}

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: CONSTANTS.SESSION.JWT_EXPIRY,
    }
  );
};

// Password validation helper
const validatePassword = (password) => {
  const { MIN_LENGTH, REQUIRE_UPPERCASE, REQUIRE_LOWERCASE, REQUIRE_NUMBER } =
    CONSTANTS.PASSWORD;

  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters long`;
  }
  if (REQUIRE_LOWERCASE && !/(?=.*[a-z])/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (REQUIRE_UPPERCASE && !/(?=.*[A-Z])/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (REQUIRE_NUMBER && !/(?=.*\d)/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const [existingUser] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password, phone, department, role, is_active, oauth_provider)
      VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        name,
        email,
        hashedPassword,
        phone,
        department,
        CONSTANTS.ROLES.USER,
        CONSTANTS.OAUTH_PROVIDERS.LOCAL,
      ]
    );

    const token = generateToken({
      id: result.insertId,
      email: email,
      role: CONSTANTS.ROLES.USER,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: CONSTANTS.ROLES.USER,
        authProvider: CONSTANTS.OAUTH_PROVIDERS.LOCAL,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

// Login user (local authentication)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const [users] = await db.query(
      `SELECT id, name, email, password, role, is_active, oauth_provider
      FROM users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    if (user.oauth_provider === CONSTANTS.OAUTH_PROVIDERS.GOOGLE) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please login with Google.",
        loginMethod: "google",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    await db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [
      user.id,
    ]);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.oauth_provider,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// Google Mobile Auth (React Native Expo)
exports.googleMobileAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "ID token is required",
        hint: "Send idToken obtained from Google Sign-In SDK",
      });
    }

    const verification = await verifyGoogleToken(idToken);

    if (!verification.success) {
      console.error("Token verification failed:", verification.error);
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
        error: verification.error,
      });
    }

    const { googleId, email, name, picture, emailVerified } = verification.data;

    console.log(`📱 Mobile OAuth login attempt: ${email}`);

    // Check if user exists with this Google ID
    let [users] = await db.query("SELECT * FROM users WHERE google_id = ?", [
      googleId,
    ]);

    if (users.length > 0) {
      const user = users[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "Account is inactive. Please contact administrator.",
        });
      }

      await db.query(
        `UPDATE users
        SET last_login = NOW(),
        avatar_url = ?,
        email_verified = ?
        WHERE id = ?`,
        [picture, emailVerified, user.id]
      );

      const token = generateToken(user);

      console.log(`✅ Existing user logged in: ${user.email}`);

      return res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          authProvider: CONSTANTS.OAUTH_PROVIDERS.GOOGLE,
          avatar: picture,
          emailVerified: emailVerified,
        },
      });
    }

    // Check if user exists with same email (different auth method)
    [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length > 0) {
      const user = users[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "Account is inactive. Please contact administrator.",
        });
      }

      await db.query(
        `UPDATE users
        SET google_id = ?,
        oauth_provider = ?,
        avatar_url = ?,
        email_verified = ?,
        last_login = NOW()
        WHERE id = ?`,
        [
          googleId,
          CONSTANTS.OAUTH_PROVIDERS.GOOGLE,
          picture,
          emailVerified,
          user.id,
        ]
      );

      const token = generateToken(user);

      console.log(`🔗 Google account linked: ${user.email}`);

      return res.json({
        success: true,
        message: "Account linked successfully",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          authProvider: CONSTANTS.OAUTH_PROVIDERS.GOOGLE,
          avatar: picture,
          emailVerified: emailVerified,
        },
      });
    }

    // Create new user with Google OAuth
    const [result] = await db.query(
      `INSERT INTO users (
        name,
        email,
        google_id,
        oauth_provider,
        email_verified,
        avatar_url,
        role,
        is_active,
        last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
      [
        name,
        email,
        googleId,
        CONSTANTS.OAUTH_PROVIDERS.GOOGLE,
        emailVerified,
        picture,
        CONSTANTS.ROLES.USER,
      ]
    );

    const token = generateToken({
      id: result.insertId,
      email: email,
      role: CONSTANTS.ROLES.USER,
    });

    console.log(`✨ New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: CONSTANTS.ROLES.USER,
        department: null,
        authProvider: CONSTANTS.OAUTH_PROVIDERS.GOOGLE,
        avatar: picture,
        emailVerified: emailVerified,
      },
    });
  } catch (error) {
    console.error("Google mobile auth error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      });
    }

    const [users] = await db.query(
      "SELECT id, email, name, oauth_provider FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        message: "If email exists, password reset instructions have been sent",
      });
    }

    if (users[0].oauth_provider === CONSTANTS.OAUTH_PROVIDERS.GOOGLE) {
      return res.status(400).json({
        success: false,
        message:
          "This account uses Google Sign-In. Password reset is not available.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetTokenExpiry = new Date(
      Date.now() + CONSTANTS.SESSION.RESET_TOKEN_EXPIRY
    );

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetTokenHash, resetTokenExpiry, users[0].id]
    );

    // For React Native - always use deep link
    const resetUrl = `${
      process.env.FRONTEND_URL_PROD || "yourapp://"
    }reset-password?token=${resetToken}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Password Reset Request - Lab Management System",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px; }
            .token-box {
              background: white;
              padding: 15px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 16px;
              word-break: break-all;
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${users[0].name}</strong>,</p>
              <p>You requested to reset your password for your Lab Management System account.</p>
              <p><strong>Your Reset Token:</strong></p>
              <div class="token-box">${resetToken}</div>
              <p>Copy this token and paste it in the mobile app.</p>
              <p><strong>⏰ This token will expire in 1 hour.</strong></p>
              <p>If you didn't request this password reset, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Lab Management System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
        `,
      });

      console.log("📧 Password reset email sent to:", email);
    } catch (emailError) {
      console.error("📧 Email sending failed:", emailError);
      await db.query(
        "UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
        [users[0].id]
      );

      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "If email exists, password reset instructions have been sent",
      ...(process.env.NODE_ENV === "development" && {
        debug: {
          token: resetToken,
          resetUrl: resetUrl,
        },
      }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and new password",
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [users] = await db.query(
      "SELECT id, email, name FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [resetTokenHash]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [hashedPassword, users[0].id]
    );

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    // For JWT-based auth, client handles token removal
    // This endpoint exists for consistency
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// Verify token
exports.verifyToken = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, name, email, role, is_active, oauth_provider, avatar_url
      FROM users WHERE id = ?`,
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Verify token error:", error);
    res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, name, email, role, is_active, oauth_provider
      FROM users WHERE id = ?`,
      [req.userId]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    const token = generateToken(users[0]);

    res.json({
      success: true,
      token,
      user: {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role,
        authProvider: users[0].oauth_provider,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
    });
  }
};
