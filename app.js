"use strict";
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { Passport } = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const { HttpError } = require("./lib/validation");

function createApp({
  sessionSecret,
  store,
  production = false,
  trustProxy = false,
} = {}) {
  if (
    !sessionSecret ||
    sessionSecret.length < 32 ||
    (production && sessionSecret.startsWith("replace-with-"))
  )
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  if (production && !store)
    throw new Error("A persistent session store is required in production.");
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    Object.assign(res.locals, {
      currentUser: null,
      error: [],
      success: [],
      csrfToken: "",
    });
    next();
  });
  if (trustProxy) app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "https:", "data:"],
          "upgrade-insecure-requests": production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(
    "/vendor/bootstrap",
    express.static(path.join(__dirname, "node_modules/bootstrap/dist")),
  );
  app.use(express.static(path.join(__dirname, "public")));
  app.use(
    express.urlencoded({ extended: true, limit: "20kb", parameterLimit: 50 }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use(require("method-override")("_method"));
  app.use(
    session({
      name: "yelpcamp.sid",
      secret: sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        maxAge: 86400000,
      },
    }),
  );
  app.use(require("./lib/flash"));
  const passport = new Passport();
  passport.use(new LocalStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    req.session.csrfToken ||= crypto.randomBytes(32).toString("hex");
    res.locals.csrfToken = req.session.csrfToken;
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const token = req.get("X-CSRF-Token") || req.body?._csrf;
      if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        !crypto.timingSafeEqual(
          Buffer.from(token),
          Buffer.from(req.session.csrfToken),
        )
      ) {
        return next(
          new HttpError(
            403,
            "Your form has expired. Reload the page and try again.",
          ),
        );
      }
    }
    next();
  });
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/", require("./routes/index")(passport));
  app.use("/campgrounds/:id/comments", require("./routes/comments"));
  app.use("/campgrounds", require("./routes/campgrounds"));
  app.use((req, res, next) => next(new HttpError(404, "Page not found.")));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status || 500;
    if (err.name === "CastError") status = 404;
    if (err.name === "ValidationError" || err.type === "entity.parse.failed")
      status = 400;
    if (err.code === 11000 || err.name === "UserExistsError") status = 409;
    if (status >= 500) console.error(err);
    const message =
      status >= 500
        ? "Something went wrong. Please try again later."
        : status === 404
          ? "Page or record not found."
          : status === 409
            ? "That username is already registered."
            : err.message;
    if (
      req.path.startsWith("/api") ||
      req.accepts(["html", "json"]) === "json"
    ) {
      return res.status(status).json({ error: message });
    }
    res.status(status).render("error", { status, message });
  });
  return app;
}
module.exports = { createApp };
