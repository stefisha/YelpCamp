"use strict";
const { rateLimit } = require("express-rate-limit");
const User = require("../models/user");
const Campground = require("../models/campground");
const m = require("../middleware");
const { text, campgroundInput, HttpError } = require("../lib/validation");
module.exports = function authRoutes(passport) {
  const router = require("express").Router();
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "Too many account attempts. Please try again in 15 minutes.",
  });
  router.get("/", (req, res) => res.render("landing"));
  router.get("/register", (req, res) => res.render("register"));
  router.post("/register", limit, async (req, res, next) => {
    const username = text(req.body.username, "Username", 32);
    if (!/^[a-zA-Z0-9_]{6,32}$/.test(username))
      throw new HttpError(
        400,
        "Use 6 to 32 letters, numbers or underscores for your username.",
      );
    if (
      typeof req.body.password !== "string" ||
      req.body.password.length < 12 ||
      req.body.password.length > 128
    ) {
      throw new HttpError(
        400,
        "Choose a password between 12 and 128 characters.",
      );
    }
    const account = await User.register(
      new User({ username }),
      req.body.password,
    );
    req.logIn(account, (err) => {
      if (err) return next(err);
      req.flash("success", `Welcome to YelpCamp, ${account.username}!`);
      res.redirect("/campgrounds");
    });
  });
  router.get("/login", (req, res) => res.render("login"));
  router.post("/login", limit, (req, res, next) => {
    if (
      typeof req.body.username !== "string" ||
      typeof req.body.password !== "string" ||
      req.body.username.length > 32 ||
      req.body.password.length > 128
    ) {
      throw new HttpError(400, "Enter a valid username and password.");
    }
    passport.authenticate("local", {
      successRedirect: "/campgrounds",
      failureRedirect: "/login",
      failureFlash: "Invalid username or password.",
    })(req, res, next);
  });
  router.post("/logout", (req, res, next) =>
    req.logout((err) => {
      if (err) return next(err);
      req.flash("success", "Logged you out.");
      res.redirect("/campgrounds");
    }),
  );
  router.get("/api", async (req, res) =>
    res.json(
      await Campground.find({})
        .select("name price image description author")
        .sort({ _id: -1 })
        .limit(100),
    ),
  );
  router.post("/api", m.isLoggedIn, async (req, res) => {
    const record = await Campground.create({
      ...campgroundInput(req.body),
      author: { id: req.user._id, username: req.user.username },
    });
    res.status(201).json(record);
  });
  router.put("/api/:id", m.checkCampgroundOwnership, async (req, res) => {
    Object.assign(req.campground, campgroundInput(req.body));
    await req.campground.save();
    res.json(req.campground);
  });
  router.delete("/api/:id", m.checkCampgroundOwnership, async (req, res) => {
    await require("./campgrounds").deleteCampground(req.campground);
    res.sendStatus(204);
  });
  return router;
};
