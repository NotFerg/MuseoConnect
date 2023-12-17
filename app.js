const express = require("express");
const app = express();
const port = 3000;

const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Chart = require("chart.js");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const sharp = require("sharp");
require("dotenv").config();

const MongoDBStore = require("connect-mongodb-session")(session); // Import the MongoDB session store

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
const methodOverride = require("method-override");
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions", // Collection name for sessions
  expires: 1000 * 60 * 60 * 24 * 7, // Session expiration (1 week)
});

store.on("error", (error) => {
  console.error("MongoDB session store error:", error);
});

//Users
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  type: String,
  score: String,
  gender: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: String,
  resetPasswordToken: String, // New field for reset token
  resetPasswordExpires: Date, // New field for reset token expiration time
});

const User = mongoose.model("User", userSchema);

//nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

//RESERVATION
const reservationSchema = new mongoose.Schema({
  visitDate: Date,
  visitTime: String,
  fullName: String,
  emailAddress: String,
  contactNumber: Number,
  numberOfVisitors: Number,
});
const Reservation = mongoose.model("Reservation", reservationSchema);

//BLOCKED DATES
const blockedSchema = new mongoose.Schema({
  blockedDate: {
    type: Date,
    required: true,
  },
  blockedTimes: [String],
});
const Blocked = mongoose.model("blocked", blockedSchema);

//ARTIFACTS
const artifactSchema = new mongoose.Schema({
  title: {
      type: String,
      required: true,
    type: String,
    required: true,
  },
  type: {
      type: String,
      required: true,
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  description: {
      type: String,
      required: true,
    type: String,
    required: true,
  },
  image: {
      type: String,
      required: true,
    type: String,
    required: true,
  },
  sketchfabLink: {
      type: String,
    type: String,
  },
});

const Artifact = mongoose.model("artifact", artifactSchema);

const generateSecureSecret = () => {
  return crypto.randomBytes(64).toString("hex");
};

//QUESTIONS
const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['multiple-choice', 'fill-in-the-blank'], required: true },
  question: { type: String, required: true },
  options: [String],  // Only used for multiple-choice questions
  correctAnswer: { type: String, required: true }
});

const Question = mongoose.model('Question', questionSchema);

//MIDDLEWARE FOR FETCHING DATA FROM ROUTE AND SENDING TO ANOTHER ROUTE
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    store: store,
  })
);

// Middleware to prevent caching
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.session) {
    // Reset the session timeout when the user interacts with the server
    req.session._garbage = Date();
    req.session.touch();

    // Set the session as active
    req.session.active = true;

    // Start a timeout to set the session as inactive after 5 minutes
    setTimeout(() => {
      if (req.session) {
        req.session.active = false;
      }
    }, 300000); // 300,000 milliseconds = 5 minutes
  }

  next();
});

//Inactivity reset
app.get("/reset-inactivity", (req, res) => {
  // Reset the session as active
  req.session.active = true;
  res.sendStatus(200); // Send a success response
});

const storage = multer.memoryStorage();

// Define the file filter function
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|bmp|webp|tiff/;
  const extname = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    return cb(
      "Error: Only JPG, PNG, GIF, BMP, WebP, and TIFF files are allowed!"
    );
  }
};

// Set up the multer middleware with the storage and file filter
const upload = multer({ storage: storage, fileFilter: fileFilter });

//NOT LOGGED IN
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/signUp", (req, res) => {
  res.render("signUp");
});

app.get("/signIn", (req, res) => {
  res.render("signIn");
});

app.get("/aboutUs", (req, res) => {
  res.render("aboutUs");
});

app.get("/donation", (req, res) => {
  res.render("donation");
});

app.get("/wrongPassword", (req, res) => {
  res.render("wrongPassword");
});

app.get("/notFound", (req, res) => {
  res.render("notFound");
});

app.get("/forgotPassword", (req, res) => {
  res.render("forgotPassword");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/");
  });
});

//Logged In
app.get("/loggedInindex", (req, res) => {
  const user = req.session.user;
  // Check if the user's session is still active
  if (!req.session.active) {
    // If not active, redirect the user to the login page or perform a logout operation
    return res.redirect("/logout"); // You should implement the /logout route for your application
  }
  req.session.active = true; // Reset the user's activity time
  res.render("loggedInindex", { user }); // Render the index page
});

app.get("/loggedInaboutUs", (req, res) => {
  const user = req.session.user;

  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedInaboutUs", { user });
});

app.get("/loggedIndonation", (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedIndonation", { user });
});

app.get("/loggedInartifacts", async (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;

  let artifacts = await Artifact.find();
  const { search } = req.query;

  // Filter artifacts based on the search query if it exists
  if (search) {
    artifacts = artifacts.filter(artifact =>
      artifact.title.toLowerCase().includes(search.toLowerCase())
    );
  }

  res.render("loggedInartifacts", { user, artifacts, search });
});

app.get("/loggedInvirtualTour", (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedInvirtualTour", { user });
});

app.get("/loggedIngames", async (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
      return res.redirect("/logout");
  }
  req.session.active = true;

  try {
      const quizQuestions = await Question.find({});
      const leaderboard = await User.find({}).sort({ score: -1 }).limit(10); // Fetch top 10 users for leaderboard

      res.render("loggedIngames", { user, quizQuestions, leaderboard });
  } catch (error) {
      console.error("Error fetching data: ", error);
      res.status(500).send("Error loading the games page");
  }
});



app.get("/loggedInreservation", async (req, res) => {
  const user = req.session.user;
  try {
    const blockedSlots = await Blocked.find();
    let reservations = await Reservation.find();

    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;

    res.render("loggedInreservation", { user, blockedSlots, reservations });
  } catch (error) {
    res.redirect("/logout");
    console.error("Error fetching blocked slots:", error);
    res.status(500).send("An error occurred while fetching blocked slots.");
  }
});

app.get("/loggedInevaluation", (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedInevaluation", { user });
});

app.get("/loggedInaccountInformation", async (req, res) => {
  const user = req.session.user; // Retrieve user data from the session

  try {
    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;
    let userReservations = await Reservation.find({ emailAddress: user.email });
    const blockedSlots = await Blocked.find();
    let reservations = await Reservation.find();
    res.render("loggedInaccountInformation", { user, userReservations,blockedSlots,reservations });
  } catch (error) {
    res.redirect("/logout");
    console.error("Error fetching reservations: ", error);
    res.status(500).send("An error occurred while fetching reservations.");
  }
});

app.get("/loggedInadmin", async (req, res) => {
  const admin = req.session.user; // Retrieve user data from the session
  try {
    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;
    let users = await User.find();

    const { search } = req.query;
    if (search) {
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.render("loggedInadmin", {
      users,
      search,
      admin,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("An error occurred while fetching users.");
  }
});


app.get("/loggedInadminartifacts", async (req, res) => {
  const admin = req.session.user; // Retrieve user data from the session
  try {
    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;
    let artifacts = await Artifact.find();

    res.render("loggedInadminartifacts", {
      admin,
      artifacts,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("An error occurred while fetching users.");
  }
});


app.get("/loggedInadminblocked", async (req, res) => {
  const admin = req.session.user; // Retrieve user data from the session
  try {
    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;

    let users = await User.find();
    let reservations = await Reservation.find();
    let blocked = await Blocked.find();
    let artifacts = await Artifact.find();

    const { search } = req.query;
    if (search) {
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.render("loggedInadminblocked", {
      users,
      search,
      admin,
      reservations,
      blocked,
      artifacts,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("An error occurred while fetching users.");
  }
});

app.get("/loggedInadminreports", async (req, res) => {
  const admin = req.session.user; // Retrieve user data from the session
  try {
    if (!req.session.active) {
      return res.redirect("/logout");
    }
    req.session.active = true;
    let users = await User.find();
    let reservations = await Reservation.find();
    let blocked = await Blocked.find();
    // let artifactType = await Artifact.find();
    // const artifacts = artifactType.map(artifactType => artifactType.type);

    let artifacts = await Artifact.find().select('type');


    const { search } = req.query;
    if (search) {
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.render("loggedInadminreports", {
      users,
      search,
      admin,
      reservations,
      blocked,
      artifacts,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("An error occurred while fetching users.");
  }
});

app.get("/loggedInadminreservation", async (req, res) => {
  const admin = req.session.user; // Retrieve user data from the session
  try {
      if (!req.session.active) {
          return res.redirect("/logout");
      }
      req.session.active = true;
      let users = await User.find();
      let reservations = await Reservation.find();

      const { search, date } = req.query;

      // Filter users by name/email if search term is present
      if (search) {
          users = users.filter(
              (user) =>
                  user.name.toLowerCase().includes(search.toLowerCase()) ||
                  user.email.toLowerCase().includes(search.toLowerCase())
          );
      }

      // Filter reservations by date if date term is present
      if (date) {
          reservations = reservations.filter(
              (reservation) =>
                  reservation.visitDate &&
                  reservation.visitDate.toISOString().split('T')[0].includes(date)
          );
      }

      res.render("loggedInadminreservation", {
          users,
          search,
          admin,
          reservations,
      });
  } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("An error occurred while fetching users.");
  }
});

app.get('/loggedInadminquestions', async (req, res) => {
  try {
      // Fetching questions from the database
      const questions = await Question.find({});
      // Rendering the EJS file with the fetched questions
      res.render('loggedInadminquestions', { questions: questions });
  } catch (error) {
      console.error("Error fetching questions: ", error);
      res.status(500).send("Error fetching questions");
  }
});

//mongodb Paths
app.post("/signIn", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("notFound");
    }

    // Check if the user is verified
    if (!user.isVerified) {
      return res.render("notVerified");
    }

    // Compare the entered password with the stored hashed password using bcryptjs
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.render("wrongPassword");
    }

    if (user.type === "Student" || user.type === "Teacher") {
      req.session.user = user; // Store user data in the session
      res.redirect("/loggedInaccountInformation");
    } else if (user.type === "admin") {
      req.session.user = user; // Store user data in the session
      res.redirect("/loggedInadmin"); // Corrected the route
    } else {
      req.session.user = user; // Store user data in the session
      res.redirect("/loggedInaccountInformation");
    }
  } catch (error) {
    console.error("Error finding user:", error);
    res.status(500).send("An error occurred during login.");
  }
});

// Define a function to generate a random verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Signup route with email verification
app.post("/signUp", async (req, res) => {
  const { name, email, userType, studentType, teacherType, dlsuStaff, password, gender } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.send(
        `<script>alert("User already exists"); window.location.href = "/signIn";</script>`
      );
    }

    const verificationCode = generateVerificationCode();

    // Hash the user's password before saving it using bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let finalUserType = userType;
    if (userType === "Student" && studentType) {
      finalUserType = studentType;
    } else if (userType === "Teacher" && teacherType) {
      finalUserType = teacherType;
    } else if (userType === "DLSU-D Staff" && dlsuStaff) {
      finalUserType = dlsuStaff;
    }

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      type: finalUserType, // Use the specific type
      gender,
      isVerified: false,
      verificationCode,
    });

    await newUser.save();

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    // Redirect to a "check your email" page
    return res.send(
      `<script>alert("Account Created. Please check your email for verification. Please also check your junk/spam folders for the email"); window.location.href = "/signIn";</script>`
    );
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("An error occurred during registration.");
  }
});


// Define a function to send a verification email
async function sendVerificationEmail(email, verificationCode) {
  const gmailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const outlookTransporter = nodemailer.createTransport({
    service: "outlook",
    auth: {
      user: process.env.OUTLOOK_USER,
      pass: process.env.OUTLOOK_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const verificationLink = `https://museo-connect.vercel.app/verify?code=${encodeURIComponent(
    verificationCode
  )}`;
  const verificationTest =
    "localhost:3000/verify?code=${encodeURIComponent(verificationCode)}";

  const mailOptions = {
    from: "rasheed.taban12@gmail.com",
    to: email,
    subject: "Account Verification",
    html: `
      <p>Thank you for signing up! To verify your email, click the following link:</p>
      <a href="${verificationLink}">Verify Email</a>
    `,
  };

  try {
    const gmailInfo = await gmailTransporter.sendMail(mailOptions);
    console.log("Verification email sent via Gmail:", gmailInfo.response);
    return { success: true, service: "Gmail" };
  } catch (gmailError) {
    console.error("Error sending verification email via Gmail:", gmailError);
  }

  try {
    const outlookInfo = await outlookTransporter.sendMail(mailOptions);
    console.log("Verification email sent via Outlook:", outlookInfo.response);
    return { success: true, service: "Outlook" };
  } catch (outlookError) {
    console.error(
      "Error sending verification email via Outlook:",
      outlookError
    );
  }

  throw new Error("Error sending verification email");
}

// Verification route
app.all("/verify", async (req, res) => {
  const verificationCode = req.query.code || req.body.code;

  try {
    const user = await User.findOne({ verificationCode });

    if (!user) {
      return res.send("Invalid Verification Code");
    }

    // Update user's verification status
    user.isVerified = true;
    user.verificationCode = undefined; // Clear verification code after verification
    await user.save();

    if (req.method === "POST") {
      return res.send(
        `<script>alert("Email Verified. You can now login."); window.location.href = "/signIn";</script>`
      );
    } else {
      return res.redirect("/signIn");
    }
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).render("errorVerification");
  }
});

// Handle the form submission for the "Forgot Password" functionality
app.post("/forgotPassword", async (req, res) => {
  const userEmail = req.body.forgotEmail;

  // Generate a unique reset token
  const resetToken = crypto.randomBytes(20).toString("hex");

  try {
    // Find the user by email
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.render("notFound"); // Render a page indicating that the user was not found
    }

    // Store the reset token and its expiration time in the user's document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // For testing on localhost
    // const resetLink = `http://localhost:3000/reset?code=${encodeURIComponent(resetToken)}`;

    // For production
    const resetLink = `https://museo-connect.vercel.app/reset?code=${encodeURIComponent(
      resetToken
    )}`;

    // Send the password reset email
    await sendPasswordResetEmail(userEmail, resetLink);

    // For testing on localhost, you can also send the resetLink to the client as JSON
    // res.json({ resetLink });

    // For production, you can redirect or send a success message
    res.send(
      `<script>alert("Please check your email for password reset. Please also check your junk/spam folders for the email "); window.location.href = "/signIn";</script>`
    );
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    res
      .status(500)
      .send("An error occurred during the forgot password process.");
  }
});

// Function to send a password reset email
async function sendPasswordResetEmail(email, resetLink) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS, // Use an app password if two-factor authentication is enabled
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: "rasheed.taban12@gmail.com",
    to: email,
    subject: "Password Reset Request",
    html: `
      <p>We received a request to reset your password. Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.response);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}

// Reset route
app.get("/reset", async (req, res) => {
  const resetToken = req.query.code;
  try {
    // Find the user by the reset token
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is still valid
    });

    if (!user) {
      res.send(
        `<script>alert("Token is no longer valid"); window.location.href = "/signIn";</script>`
      );
    }

    // Render a page with a form to reset the password
    res.render("passwordReset", { token: resetToken });
  } catch (error) {
    console.error("Error processing password reset request:", error);
    res.status(500).render("errorReset");
  }
});

// Handle the password reset form submission
app.post("/reset/:token", async (req, res) => {
  const resetToken = req.params.token;
  const newPassword = req.body.newPassword;

  try {
    // Find the user by the reset token
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is still valid
    });

    if (!user) {
      return res.send(
        `<script>alert("Token is no longer valid"); window.location.href = "/signIn";</script>`
      );
    }

    // Hash the new password and update the user's password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;

    // Clear the reset token and its expiration time
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Save the updated user information
    await user.save();

    // Render a page indicating that the password has been reset successfully
    return res.send(
      `<script>alert("Password Reset Success"); window.location.href = "/signIn";</script>`
    );
  } catch (error) {
    console.error("Error processing password reset request:", error);
    return res.status(500).render("errorReset");
  }
});

// Handle the PUT request for updating user details
app.post("/loggedIn/admin/users/:id/update", async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.send("User not found.");
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;

    await user.save();
    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send("An error occurred while updating user.");
  }
});

//Delete User
app.delete("/loggedIn/admin/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.send("User not found.");
    }

    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).send("An error occurred while deleting user.");
  }
});

//UPDATE USER NAME
app.put("/loggedIn/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.send("User not found.");
    }

    // Update user name
    if (name) user.name = name;

    await user.save();
    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send("An error occurred while updating user.");
  }
});

//UPDATE USER EMAIL
app.put("/loggedIn/admin/users/:id/email", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.send("User not found.");
    }

    // Update user email
    if (email) user.email = email;

    await user.save();
    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).send("An error occurred while updating email.");
  }
});


// Handle the PUT request for updating password
app.put("/loggedIn/admin/users/:id/password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.send("User not found.");
    }

    // Update user password with bcrypt
    if (password) {
      const saltRounds = 10; // You can adjust the number of salt rounds for security
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      user.password = hashedPassword;
    }

    await user.save();
    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).send("An error occurred while updating password.");
  }
});

// UPDATE USER SCORE
app.put("/loggedIn/admin/users/:id/score", async (req, res) => {
  const { id } = req.params;
  const { score } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Update user's score
    user.score = score;

    await user.save();
    return res.status(200).json({ message: "Score updated successfully" });
  } catch (error) {
    console.error("Error updating score:", error);
    return res.status(500).json({ error: "An error occurred while updating score." });
  }
});

//UPDATEQUESTION ROUTE
app.put("/admin/questions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedQuestion) {
      return res.status(404).send("Question not found");
    }
    res.send("Question updated successfully");
  } catch (error) {
    res.status(500).send("Error updating question: " + error.message);
  }
});

// Adding by user Reservation
app.post("/loggedIn/reservation", async (req, res) => {
  const inpVisitDate = req.body.visitDate;
  const inpVisitTime = req.body.visitTime;
  const inpfullName = req.body.fullName;
  const inpContactNumber = req.body.contactNumber;
  const inpNumberOfVisitors = req.body.numberOfVisitors;
  const today = new Date();
  const loggedInUser = req.session.user;

  const visitDate = inpVisitDate.split("T")[0];

  try {
    const blockedSlots = await Blocked.find();
    const isDateBlocked = blockedSlots.some((blockedSlot) => {
      return blockedSlot.blockedDate === visitDate;
    });

    const isTimeBlocked = blockedSlots.some((blockedSlot) => {
      const blockDate = blockedSlot.blockedDate;
      const blockTimes = blockedSlot.blockedTimes;
      return blockDate === visitDate && blockTimes.includes(inpVisitTime);
    });

    // Check if the visit date is less than today
    if (new Date(visitDate) < new Date(today.toISOString().split("T")[0])) {
      return res.send(
        `<script>alert("Invalid visit date. Please choose a date equal to or greater than today."); window.location.href = "/loggedInreservation";</script>`
      );
    } else if (isDateBlocked && isTimeBlocked) {
      return res.send(
        `<script>alert("The selected date and time are blocked. Please choose a different date/time."); window.location.href = "/loggedInreservation";</script>`
      );
    } else {
      const existingReservationForDateTime = await Reservation.findOne({
        visitDate: new Date(visitDate),
        visitTime: inpVisitTime,
      });

      if (existingReservationForDateTime) {
        return res.send(
          `<script>alert("A reservation already exists for the selected date and time. Please choose a different date/time."); window.location.href = "/loggedInreservation";</script>`
        );
      }

      const newReservation = new Reservation({
        visitDate: new Date(visitDate),
        visitTime: inpVisitTime,
        fullName: inpfullName,
        emailAddress: loggedInUser.email,
        contactNumber: inpContactNumber,
        numberOfVisitors: inpNumberOfVisitors,
      });

      // Save the reservation
      await newReservation.save();

      // automated email to admin
      const adminEmail = process.env.GMAIL_USER;
      const reservationName = req.body.fullName;
      const reservationDate = moment(req.body.visitDate).format("YYYY-MM-DD");
      const reservationTime = req.body.visitTime;

      const adminMailOptions = {
        from: process.env.GMAIL_USER,
        to: adminEmail,
        subject: "New Reservation",
        text: `A new reservation has been made by ${reservationName} for ${reservationDate} at ${reservationTime}.`,
      };

      // Send the email to admin
      transporter.sendMail(adminMailOptions, (error, adminInfo) => {
        if (error) {
          console.error("Error sending admin email:", error);
          // Handle the error, e.g., log it or take other actions
        } else {
          console.log("Admin email sent:", adminInfo.response);
          // Handle the success, e.g., log it or take other actions
        }
      });

      // automated email to user
      const userMailOptions = {
        from: process.env.GMAIL_USER,
        to: loggedInUser.email,
        subject: "Reservation Confirmation",
        text: `Thank you for your reservation, ${reservationName}! Your reservation is confirmed for ${reservationDate} at ${reservationTime}.`,
      };

      // Send the email to user
      transporter.sendMail(userMailOptions, (error, userInfo) => {
        if (error) {
          console.error("Error sending user email:", error);
          // Handle the error, e.g., log it or take other actions
        } else {
          console.log("User email sent:", userInfo.response);
          // Handle the success, e.g., log it or take other actions
        }
      });

      // Send a response to the client
      res.send(
        `<script>alert("Reservation Success"); window.location.href = "/loggedInaccountInformation";</script>`
      );
    }
  } catch (error) {
    console.error("Error saving reservation:", error);
    res.status(500).send("An error occurred while saving the reservation.");
  }
});

// Rebook of Reservation
app.post("/loggedInaccountInformation/rebook/:id", async (req, res) => {
  const reservationId = req.params.id;
  const inpVisitDate = req.body.visitDate;
  const inpVisitTime = req.body.visitTime;
  const inpContactNumber = req.body.contactNumber;
  const inpNumberOfVisitors = req.body.numberOfVisitors;
  const today = new Date();
  const loggedInUser = req.session.user;

  const visitDate = new Date(inpVisitDate);

  try {
    // Check if the visit date is less than today
    if (visitDate < today) {
      return res.send(`<script>alert("Invalid visit date. Please choose a date equal to or greater than today."); window.location.href = "/loggedInaccountInformation";</script>`);
    }

    // Check for blocked dates and times
    const isDateOrTimeBlocked = await Blocked.findOne({
      blockedDate: visitDate,
      blockedTimes: inpVisitTime
    });

    if (isDateOrTimeBlocked) {
      return res.send(`<script>alert("The selected date and time are blocked. Please choose a different date/time."); window.location.href = "/loggedInaccountInformation";</script>`);
    }

    // Check if there's already a reservation for the selected date and time (excluding the current reservation)
    const existingReservation = await Reservation.findOne({
      _id: { $ne: reservationId },
      visitDate: visitDate,
      visitTime: inpVisitTime
    });

    if (existingReservation) {
      return res.send(`<script>alert("A reservation already exists for the selected date and time. Please choose a different date/time."); window.location.href = "/loggedInaccountInformation";</script>`);
    }

    // Update the reservation
    await Reservation.findByIdAndUpdate(reservationId, {
      visitDate: visitDate,
      visitTime: inpVisitTime,
      contactNumber: inpContactNumber,
      numberOfVisitors: inpNumberOfVisitors
    });

    // Email setup
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false,
      }
    });

    // Send confirmation email to admin
    const adminEmail = process.env.GMAIL_USER;
    const reservationDate = moment(visitDate).format("YYYY-MM-DD");

    const adminMailOptions = {
      from: process.env.GMAIL_USER,
      to: adminEmail,
      subject: "Reservation Update",
      text: `A reservation has been updated by ${loggedInUser.name} for ${reservationDate} at ${inpVisitTime}.`
    };

    transporter.sendMail(adminMailOptions, (error, info) => {
      if (error) {
        console.error("Error sending admin email:", error);
      } else {
        console.log("Admin email sent:", info.response);
      }
    });

    // Send confirmation email to user
    const userMailOptions = {
      from: process.env.GMAIL_USER,
      to: loggedInUser.email,
      subject: "Reservation Update Confirmation",
      text: `Your reservation has been updated successfully. New date and time: ${reservationDate} at ${inpVisitTime}.`
    };

    transporter.sendMail(userMailOptions, (error, info) => {
      if (error) {
        console.error("Error sending user email:", error);
      } else {
        console.log("User email sent:", info.response);
      }
    });

    // Response to client
    res.send(`<script>alert("Reservation updated successfully!"); window.location.href = "/loggedInaccountInformation";</script>`);
  } catch (error) {
    console.error("Error updating reservation:", error);
    res.status(500).send("An error occurred while updating the reservation.");
  }
});

// Removal of Reservation by admin
app.post("/loggedIn/admin/remove-reservation/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Find the reservation by ID and remove it
    await Reservation.findByIdAndRemove(id);

    // Redirect back to the account information page after removal
    res.redirect("/loggedInadminreservation");
  } catch (error) {
    console.error("Error removing reservation:", error);
    res.status(500).send("An error occurred while removing the reservation.");
  }
});

// Removal of Reservation by user
app.post(
  "/loggedInaccountInformation/remove-reservation/:id",
  async (req, res) => {
    const { id } = req.params;
    try {
      // Find the reservation by ID and remove it
      await Reservation.findByIdAndRemove(id);

      // Redirect back to the account information page after removal
      return res.send(
        '<script>alert("Removal Success"); window.location.href = "/loggedInaccountInformation";</script>'
      );
    } catch (error) {
      console.error("Error removing reservation:", error);
      res.status(500).send("An error occurred while removing the reservation.");
    }
  }
);

// Update Visit Date
app.put("/loggedIn/admin/reservations/:id/visitDate", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const newVisitDate = req.body.visitDate;
    const today = new Date();

    // Check if the new visit date is less than today
    if (new Date(newVisitDate) < new Date(today.toISOString().split("T")[0])) {
      return res.send(
        `<script>alert("Invalid visit date. Please choose a date equal to or greater than today."); window.location.href = "/loggedInreservation";</script>`
      );
    }

    // Find the reservation by ID and update the visitDate field
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    reservation.visitDate = newVisitDate;
    // Save the updated reservation
    await reservation.save();
    // Redirect or send a response as needed
    res.redirect("/loggedInadminreservation");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update Visit Time
app.put("/loggedIn/admin/reservations/:id/visitTime", async (req, res) => {
  const { id } = req.params;
  const { visitTime } = req.body;

  try {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.send("Reservation not found.");
    }

    // Update reservation visit time
    if (visitTime) reservation.visitTime = visitTime;

    await reservation.save();
    return res.send(
      `<script>alert("Time succesfully updated!"); window.location.href = "/loggedInadminreservation";</script>`
    );
  } catch (error) {
    console.error("Error updating visit time:", error);
    res.status(500).send("An error occurred while updating visit time.");
  }
});

// Update Contact Number
app.put("/loggedIn/admin/reservations/:id/contactNumber", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const newContactNumber = req.body.contactNumber;

    // Find the reservation by ID and update the contactNumber field
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    reservation.contactNumber = newContactNumber;
    // Save the updated reservation
    await reservation.save();
    // Redirect or send a response as needed
    res.redirect("/loggedInadminreservation");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update Number of Visitors
app.put(
  "/loggedIn/admin/reservations/:id/numberOfVisitors",
  async (req, res) => {
    try {
      const reservationId = req.params.id;
      const newNumberOfVisitors = req.body.numberOfVisitors; // Make sure this matches the input field name in your form

      // Find the reservation by ID and update the numberOfVisitors field
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }

      reservation.numberOfVisitors = newNumberOfVisitors;

      // Save the updated reservation
      await reservation.save();

      // Redirect or send a response as needed
      res.redirect("/loggedInadminreservation");
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Add Blocked Dates
app.post("/loggedIn/admin/addBlockedDates", async (req, res) => {
  console.log("Received a POST request to /loggedIn/admin/addBlockedDates");

  try {
    // Extracting the start date, end date, and time slots from the request
    const startDateString = req.body.startDate;
    const endDateString = req.body.endDate || startDateString; // Use start date as end date if end date is not provided
    const blockedTimes = req.body.blockedTimes;

    console.log("Received startDate:", startDateString);
    console.log("Received endDate:", endDateString);
    console.log("Received blockedTimes:", blockedTimes);

    // Function to generate all dates in the range
    function generateDateRange(startDate, endDate) {
      const dateRange = [];
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dateRange.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dateRange;
    }

    // Validate and generate the date range
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Invalid date format");
    }
    const dateRange = generateDateRange(startDate, endDate);

    // Process each date in the range
    for (const date of dateRange) {
      let existingBlockedDate = await Blocked.findOne({
        blockedDate: date,
      });

      if (existingBlockedDate) {
        // If the date already exists in the database, append new times
        existingBlockedDate.blockedTimes.push(...blockedTimes);
        await existingBlockedDate.save();
      } else {
        // Create a new document if it doesn't exist
        const newBlockedDate = new Blocked({
          blockedDate: date,
          blockedTimes: blockedTimes,
        });
        await newBlockedDate.save();
      }
    }

    // Redirect after the database is updated
    res.json({ success: true, message: "Blocked dates added successfully" });
  } catch (err) {
    console.error("Error occurred:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update Blocked Date
app.put("/loggedIn/admin/blocked/:id/blockedDate", async (req, res) => {
  try {
    const blockedId = req.params.id;
    const newBlockedDate = req.body.updblockedDate;

    const blocked = await Blocked.findById(blockedId);
    if (!blocked) {
      return res.status(404).json({ error: "Blocked not found" });
    }

    blocked.blockedDate = newBlockedDate;

    // Save the updated blocked date
    await blocked.save();

    // Redirect or send a response as needed
    res.redirect("/loggedInadminblocked");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove Blocked Time
app.post("/loggedIn/admin/removeBlockedTime/:id", async (req, res) => {
  try {
    const blockedId = req.params.id;
    const removedTime = req.body.time; // Get the time from the hidden input field

    const blocked = await Blocked.findById(blockedId);
    if (!blocked) {
      return res.status(404).json({ error: "Blocked not found" });
    }

    // Remove the specified time from the blockedTimes array
    blocked.blockedTimes = blocked.blockedTimes.filter(
      (time) => time !== removedTime
    );

    // Save the updated blocked date
    await blocked.save();

    // Redirect back to the page
    res.redirect("/loggedInadminblocked");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove Blocked Date
app.post("/loggedIn/admin/removeBlockedDate/:id", async (req, res) => {
  try {
    const blockedId = req.params.id;
    await Blocked.findByIdAndRemove(blockedId);

    // Redirect or send a response as needed
    res.redirect("/loggedInadminblocked");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to save the score
app.post("/saveScore", async (req, res) => {
  const { score } = req.body;
  const loggedInUser = req.session.user; // Assuming you have session middleware set up

  try {
    const user = await User.findOne({ email: loggedInUser.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the user's score
    user.score = score;
    await user.save();

    // Update the session user with the new data
    req.session.user = user;

    console.log("Score updated successfully:", user.score);

    // Redirect to the desired page after updating the score
    return res.status(200).json({ message: "Score updated successfully" });
  } catch (error) {
    console.error("Error updating score:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

//Adding an artifact
app.post(
  "/loggedIn/admin/addArtifact",
  upload.single("image"),
  async (req, res) => {
    const { title, description, type, status, sketchfabLink } = req.body;

    try {
      let imageUrl;
      if (req.file) {
        const uploadOptions = {
          use_filename: true,
          unique_filename: true,
          overwrite: true,
          folder: "museo", // Specify the folder name here
          public_id: req.file.originalname.split(".")[0], // Set file name without extension
          resource_type: "auto",
        };

        // Upload the image to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(uploadOptions, (error, result) => {
              if (error) reject(error);
              else resolve(result);
            })
            .end(req.file.buffer);
        });

        imageUrl = uploadResult.url;
      }

      const artifact = new Artifact({
        title,
        type,
        status, // Include status
        description,
        image: imageUrl, // Using the URL from Cloudinary
        sketchfabLink,
      });

      await artifact.save();
      res.redirect("/loggedInadminartifacts");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error adding artifact: " + error.message);
    }
  }
);

//Updating an artifact
app.put(
  "/loggedIn/admin/artifacts/:artifactId",
  upload.single("updateImage"),
  async (req, res) => {
    const {
      updateTitle,
      updateDescription,
      updateType,
      updateStatus,
      updateSketchfabLink,
    } = req.body;
    const artifactId = req.params.artifactId;

    try {
      const artifact = await Artifact.findById(artifactId);
      if (!artifact) {
        return res.status(404).send("Artifact not found");
      }

      if (req.file) {
        // Delete the old image from Cloudinary, if it exists
        if (artifact.image) {
          const publicId = extractPublicId(artifact.image);
          const decodedPublicId = decodeURIComponent(publicId); // Decode URL-encoded public ID
          console.log(decodedPublicId);
          await cloudinary.uploader.destroy("museo/" + decodedPublicId);
        }

        // Upload the new image to Cloudinary
        let uploadResult;
        const uploadOptions = {
          use_filename: true,
          unique_filename: true,
          overwrite: true,
          folder: "museo", // Specify the folder name here
          public_id: req.file.originalname.split(".")[0], // Set file name without extension
          resource_type: "auto",
        };

        uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(uploadOptions, (error, result) => {
              if (error) reject(error);
              else resolve(result);
            })
            .end(req.file.buffer);
        });

        artifact.image = uploadResult.url; // Update with new image URL
      }

      // Update other details
      artifact.title = updateTitle;
      artifact.description = updateDescription;
      artifact.type = updateType;
      artifact.status = updateStatus;
      artifact.sketchfabLink = updateSketchfabLink;

      await artifact.save();
      res.redirect("/loggedInadminartifacts");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating artifact: " + error.message);
    }
  }
);

//Deleting an artifact
app.delete("/loggedIn/admin/artifacts/:artifactId", async (req, res) => {
  const artifactId = req.params.artifactId;
  try {
      const artifact = await Artifact.findById(artifactId);
      if (!artifact) {
          return res.status(404).send("Artifact not found");
      }

      // Delete the image from Cloudinary
      if (artifact.image) {
        const publicId = extractPublicId(artifact.image);
        const decodedPublicId = decodeURIComponent(publicId); // Decode URL-encoded public ID
        console.log(decodedPublicId);
        await cloudinary.uploader.destroy("museo/" + decodedPublicId);
    }
    

      await Artifact.findByIdAndRemove(artifactId);
      res.redirect("/loggedInadminartifacts");
  } catch (error) {
      res.status(500).send("Error removing artifact: " + error.message);
  }
});

function extractPublicId(url) {
  // Extract the public ID from the URL
  // Adjust the logic based on your Cloudinary URL structure
  const parts = url.split('/');
  return parts[parts.length - 1].split('.')[0]; // Assuming the public ID is the last part before the file extension
}

//ADMINQUESTIONS
app.get('/admin/questions', async (req, res) => {
  try {
      // Assuming you have a Question model set up to interact with your questions collection
      // Fetch all the questions from the database
      const questions = await Question.find(); // Replace with your actual data retrieval logic

      // Render the admin questions management page and pass the questions to the template
      `<script>alert("Question added successfuly"); window.location.href = "/loggedInadminquestions";</script>`
      res.render('loggedInadminquestions', { questions }); // Ensure 'adminQuestions' matches your EJS file name
  } catch (error) {
      // Handle errors, such as by logging and sending a server error response
      console.error('Error fetching questions:', error);
      res.status(500).send('Error loading admin questions page');
  }
});



//DELETE QUESTION ROUTE
app.delete("/admin/questions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedQuestion = await Question.findByIdAndDelete(id);
    if (!deletedQuestion) {
      return res.status(404).send("Question not found");
    }
    res.send("Question removed successfully");
  } catch (error) {
    res.status(500).send("Error removing question: " + error.message);
  }
});


//QUESTIONS ROUTE
app.post('/admin/questions/add', async (req, res) => {
  const questionType = req.body.type;
  const questionText = req.body.question;
  let options = req.body.options;
  const correctAnswer = req.body.correctAnswer;

  // If the question type is multiple-choice, split the options string by commas
  if (questionType === 'multiple-choice') {
    options = options.split(',').map(option => option.trim()); // Split and trim each option
  } else {
    options = []; // No options for fill-in-the-blank
  }

  // Here, you should create a new question object based on your schema
  const newQuestion = new Question({
    type: questionType,
    question: questionText,
    options: options,
    correctAnswer: correctAnswer
  });

  try {
    // Save the new question to the database
    await newQuestion.save();
    res.send("Question added successfully"); // Log success message

    console.log('Question added successfully');
    res.redirect('/admin/questions'); // Redirect to the list of questions
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).send('Error adding question');
  }
});





app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
