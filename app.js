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
const crypto = require('crypto');
const sharp = require('sharp');
require('dotenv').config();


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
  .connect(
    process.env.MONGODB_URI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));


const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: 'sessions', // Collection name for sessions
  expires: 1000 * 60 * 60 * 24 * 7, // Session expiration (1 week)
});

store.on('error', (error) => {
  console.error('MongoDB session store error:', error);
});

//Users
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  type: String,
  score: String,
});
const User = mongoose.model("User", userSchema);

//nodemailer
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
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
  },
  type: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
});

const Artifact = mongoose.model("Artifact", artifactSchema);

const generateSecureSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

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
const upload = multer({ storage: storage , fileFilter:fileFilter});

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

  artifacts = artifacts.map((artifact) => {
    const decodedImage = Buffer.from(artifact.image, 'base64');
    return{...artifact.toObject(),decodedImage};
  });
  
  res.render("loggedInartifacts", { user, artifacts });
});

app.get("/loggedInvirtualTour", (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedInvirtualTour", { user });
});

app.get("/loggedIngames", (req, res) => {
  const user = req.session.user;
  if (!req.session.active) {
    return res.redirect("/logout");
  }
  req.session.active = true;
  res.render("loggedIngames", { user });
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
    let reservations = await Reservation.find({ emailAddress: user.email });
    res.render("loggedInaccountInformation", { user, reservations });
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

    // Decode Base64 image data in artifacts
    artifacts = artifacts.map((artifact) => {
      const decodedImage = Buffer.from(artifact.image, 'base64');
      // Assuming you have a property like "decodedImage" in your artifact schema
      return { ...artifact.toObject(), decodedImage };
    });

    res.render("loggedInadminartifacts", {
      admin,artifacts,
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
    let artifacts = await Artifact.find()

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
    let artifacts = await Artifact.find();

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

    const { search } = req.query;
    if (search) {
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
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

//mongodb Paths
app.post("/signIn", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("notFound");
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
      res.redirect("loggedInadmin");
    } else {
      req.session.user = user; // Store user data in the session
      res.redirect("/loggedInaccountInformation");
    }
  } catch (error) {
    console.error("Error finding user:", error);
    res.status(500).send("An error occurred during login.");
  }
});

app.post("/signUp", async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const type = req.body.userType;
  const password = req.body.password; // Plain text password

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send(
        `<script>alert("User already exists"); window.location.href = "/signIn";</script>`
      );
    }

    // Hash the user's password before saving it using bcryptjs
    const saltRounds = 10; // You can adjust the number of salt rounds for security
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      name,
      email,
      password: hashedPassword, // Store the hashed password
      type,
    });

    await newUser.save();
    return res.send(
      `<script>alert("Account Created."); window.location.href = "/signIn";</script>`
    );
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("An error occurred during registration.");
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
      return res.send("User not found.");
    }

    // Update user's score
    if (score) user.score = score;

    await user.save();
    res.redirect("/loggedInadmin");
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).send("An error occurred while updating score.");
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
    const existingReservation = await Reservation.findOne({
      emailAddress: loggedInUser.email,
    });

    const blockedSlots = await Blocked.find();
    const isDateBlocked = blockedSlots.some((blockedSlot) => {
      return blockedSlot.blockedDate === visitDate;
    });

    const isTimeBlocked = blockedSlots.some((blockedSlot) => {
      const blockDate = blockedSlot.blockedDate;
      const blockTimes = blockedSlot.blockedTimes;
      return blockDate === visitDate && blockTimes.includes(inpVisitTime);
    });

    if (existingReservation) {
      return res.send(
        `<script>alert("You already have a reservation."); window.location.href = "/loggedInreservation";</script>`
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

      // automated email code
      const adminEmail = process.env.GMAIL_USER;
      const reservationName = req.body.fullName;
      const reservationDate = moment(req.body.visitDate).format("YYYY-MM-DD");
      const reservationTime = req.body.visitTime;

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: adminEmail,
        subject: "New Reservation",
        text: `A new reservation has been made by ${reservationName} for ${reservationDate} at ${reservationTime}.`,
      };

      // Send the email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          // Handle the error, e.g., log it or take other actions
        } else {
          console.log("Email sent:", info.response);
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
    const blockedDate = req.body.blockedDate;
    const blockedTimes = req.body.blockedTimes;

    console.log("Received blockedDate:", blockedDate);
    console.log("Received blockedTimes:", blockedTimes);

    let existingBlockedDate = await Blocked.findOne({ blockedDate: blockedDate });

    if (existingBlockedDate) {
      // If a record exists, append the new blockedTimes to the existing ones
      existingBlockedDate.blockedTimes.push(...blockedTimes);
    } else {
      // If no record exists, create a new Blocked document
      existingBlockedDate = new Blocked({
        blockedDate: blockedDate,
        blockedTimes: blockedTimes,
      });
    }

    // Save the changes to the database
    await existingBlockedDate.save();
    console.log("Database updated successfully!");

    // Redirect after the database is updated
    // res.redirect("/loggedInadminblocked");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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
  const loggedInUser = req.session.user;

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

    // Log the session user before redirecting
    console.log("Session user before redirect:", req.session.user);

    res.redirect("/loggedInaccountInformation");
  } catch (error) {
    console.error("Error updating score:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// Adding artifact route
app.post("/loggedIn/admin/addArtifact",upload.single('image'),async (req, res) => {
    const { title, description, type } = req.body;
    const imageBuffer = req.file.buffer; // Get the uploaaded image as a buffer

  console.log("Received data from the form:");
  console.log("Title:", title);
  console.log("Type:", type);
  console.log("Description:", description);
  console.log("image buffer: ",imageBuffer)

  const resizedImageBuffer = await sharp(imageBuffer).resize({
    width:1920,
    height:1080,
    fit: sharp.fit.insde
  }).toBuffer();

    try {
      const artifact = new Artifact({
        title,
        type,
        description,
        image: resizedImageBuffer.toString('base64'), // Store Image as base64 string
      });
      await artifact.save();
      res.redirect("/loggedInadminartifacts"); // Redirect to the admin page after adding the artifact
    } catch (err) {
      console.error(err);
      res.status(500).send("Error adding artifact");
    }
  }
);

//Update an artifact
app.put(
  "/loggedIn/admin/artifacts/:artifactId",
  upload.single("updateImage"),
  async (req, res) => {
    const { updateTitle, updateDescription, updateType } = req.body;
    const artifactId = req.params.artifactId;

    try {
      // Find the artifact by ID
      const artifact = await Artifact.findById(artifactId);

      if (!artifact) {
        return res.status(404).send("Artifact not found");
      }

      // Check if a new image was uploaded
      if (req.file) {
        // Update the image with the new file's content (base64-encoded)
        const imageBuffer = req.file.buffer;
        artifact.image = imageBuffer.toString('base64');
      }

      // Update the title and description
      artifact.title = updateTitle;
      artifact.description = updateDescription;
      artifact.type = updateType;

      // Save the updated artifact
      await artifact.save();

      res.redirect("/loggedInadminartifacts"); // Redirect to the admin page after updating
    } catch (error) {
      res.status(500).send("Error updating artifact: " + error.message);
    }
  }
);

//Remove an artifact
app.delete("/loggedIn/admin/artifacts/:artifactId", async (req, res) => {
  const artifactId = req.params.artifactId;

  try {
    const artifact = await Artifact.findById(artifactId);

    if (!artifact) {
      return res.status(404).send("Artifact not found");
    }

    await Artifact.findByIdAndRemove(artifactId);

    res.redirect("/loggedInadminartifacts");
  } catch (error) {
    res.status(500).send("Error removing artifact: " + error.message);
  }
});


app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
