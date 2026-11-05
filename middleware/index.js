"use strict";
const mongoose = require("mongoose");
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const { HttpError } = require("../lib/validation");
function validId(id) {
  if (!mongoose.isObjectIdOrHexString(id))
    throw new HttpError(404, "Record not found.");
}
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.originalUrl.startsWith("/api"))
    return next(new HttpError(401, "Please log in."));
  req.flash("error", "You need to be logged in to do that.");
  res.redirect("/login");
}
async function loadCampground(req, res, next) {
  validId(req.params.id);
  req.campground = await Campground.findById(req.params.id);
  if (!req.campground) throw new HttpError(404, "Campground not found.");
  next();
}
function owns(document, user) {
  return user && (user.isAdmin || document.author?.id?.equals(user._id));
}
async function checkCampgroundOwnership(req, res, next) {
  if (!req.isAuthenticated()) return isLoggedIn(req, res, next);
  await loadCampground(req, res, () => {});
  if (!owns(req.campground, req.user))
    throw new HttpError(403, "You cannot change this campground.");
  next();
}
async function checkCommentOwnership(req, res, next) {
  if (!req.isAuthenticated()) return isLoggedIn(req, res, next);
  await loadCampground(req, res, () => {});
  validId(req.params.comment_id);
  if (!req.campground.comments.some((id) => id.equals(req.params.comment_id))) {
    throw new HttpError(404, "Comment not found in this campground.");
  }
  req.comment = await Comment.findById(req.params.comment_id);
  if (!req.comment) throw new HttpError(404, "Comment not found.");
  if (!owns(req.comment, req.user))
    throw new HttpError(403, "You cannot change this comment.");
  next();
}
module.exports = {
  isLoggedIn,
  loadCampground,
  checkCampgroundOwnership,
  checkCommentOwnership,
};
