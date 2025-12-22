const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    }
  );
};

// Password validation helper
const validatePassword = (password) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (!/(?=.*[a-z])/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/(?=.*\d)/.test(password)) {
    return "Password must contain at least one number";
  }

  return null;
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, department } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // Check if user already exists
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (default role is 'user')
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, phone, department, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, department, "user", true]
    );

    // Generate token
    const token = generateToken({
      id: result.insertId,
      email: email,
      role: "user",
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: "user",
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

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user
    const [users] = await db.query(
      "SELECT id, name, email, password, role, is_active FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateToken(user);

    // Update last login
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

// Logout user
exports.logout = async (req, res) => {
  try {
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
      "SELECT id, name, email, role, is_active FROM users WHERE id = ?",
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
      "SELECT id, name, email, role, is_active FROM users WHERE id = ?",
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

    // Find user
    const [users] = await db.query(
      "SELECT id, email, name FROM users WHERE email = ?",
      [email]
    );

    // Don't reveal if email exists or not (security)
    if (users.length === 0) {
      return res.json({
        success: true,
        message: "If email exists, password reset instructions have been sent",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to database
    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetTokenHash, resetTokenExpiry, users[0].id]
    );

    // Send email with reset token
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

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
              .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
              .content { background: #f5f5f5; padding: 30px; }
              .button { 
                display: inline-block; 
                background: #2196F3; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hello ${users[0].name},</p>
                <p>You requested to reset your password for your Lab Management System account.</p>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </p>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #2196F3;">${resetUrl}</p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Lab Management System. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log("Password reset email sent to:", email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

      // Clean up the reset token if email fails
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

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // Hash the token
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with valid reset token
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await db.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [hashedPassword, users[0].id]
    );

    // Send confirmation email (optional)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: users[0].email,
        subject: "Password Successfully Reset - Lab Management System",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4caf50; color: white; padding: 20px; text-align: center; }
              .content { background: #f5f5f5; padding: 30px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Successful</h1>
              </div>
              <div class="content">
                <p>Hello ${users[0].name},</p>
                <p>Your password has been successfully reset.</p>
                <p>You can now log in to your Lab Management System account with your new password.</p>
                <p>If you did not make this change, please contact support immediately.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Lab Management System. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Confirmation email failed:", emailError);
      // Don't fail the request if confirmation email fails
    }

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
