"use strict";
const router = require("express").Router({ mergeParams: true });
const Comment = require("../models/comment");
const m = require("../middleware");
const { text } = require("../lib/validation");
router.get("/new", m.isLoggedIn, m.loadCampground, (req, res) =>
  res.render("comments/new", { campground: req.campground }),
);
router.post("/", m.isLoggedIn, m.loadCampground, async (req, res) => {
  const comment = await Comment.create({
    text: text(req.body.comment?.text, "Comment", 2000),
    author: { id: req.user._id, username: req.user.username },
  });
  try {
    req.campground.comments.push(comment._id);
    await req.campground.save();
  } catch (err) {
    await comment.deleteOne();
    throw err;
  }
  req.flash("success", "Comment added.");
  res.redirect(`/campgrounds/${req.campground._id}`);
});
router.get("/:comment_id/edit", m.checkCommentOwnership, (req, res) =>
  res.render("comments/edit", {
    campground_id: req.campground._id,
    comment: req.comment,
  }),
);
router.put("/:comment_id", m.checkCommentOwnership, async (req, res) => {
  req.comment.text = text(req.body.comment?.text, "Comment", 2000);
  await req.comment.save();
  res.redirect(`/campgrounds/${req.campground._id}`);
});
router.delete("/:comment_id", m.checkCommentOwnership, async (req, res) => {
  req.campground.comments.pull(req.comment._id);
  await req.campground.save();
  await req.comment.deleteOne();
  req.flash("success", "Comment deleted.");
  res.redirect(`/campgrounds/${req.campground._id}`);
});
module.exports = router;
