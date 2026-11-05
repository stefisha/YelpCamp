"use strict";
const router = require("express").Router();
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const m = require("../middleware");
const { campgroundInput, HttpError } = require("../lib/validation");
function searchFilter(value) {
  if (value === undefined || value === "") return {};
  if (typeof value !== "string" || value.length > 120)
    throw new HttpError(400, "Search must be text of at most 120 characters.");
  return {
    name: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  };
}
router.get("/", async (req, res) =>
  res.render("campgrounds/index", {
    campgrounds: await Campground.find(searchFilter(req.query.search))
      .sort({ _id: -1 })
      .limit(100),
  }),
);
router.get("/searching", async (req, res) =>
  res.json(
    await Campground.find(searchFilter(req.query.search))
      .select("name image")
      .sort({ _id: -1 })
      .limit(100),
  ),
);
router.get("/new", m.isLoggedIn, (req, res) => res.render("campgrounds/new"));
router.post("/", m.isLoggedIn, async (req, res) => {
  await Campground.create({
    ...campgroundInput(req.body),
    author: { id: req.user._id, username: req.user.username },
  });
  req.flash("success", "Campground created.");
  res.redirect("/campgrounds");
});
router.get("/:id", m.loadCampground, async (req, res) => {
  await req.campground.populate("comments");
  res.render("campgrounds/show", { campground: req.campground });
});
router.get("/:id/edit", m.checkCampgroundOwnership, (req, res) =>
  res.render("campgrounds/edit", { campground: req.campground }),
);
router.put("/:id", m.checkCampgroundOwnership, async (req, res) => {
  Object.assign(req.campground, campgroundInput(req.body.campground));
  await req.campground.save();
  res.redirect(`/campgrounds/${req.campground._id}`);
});
async function deleteCampground(record) {
  // Clean up references before removing the parent; retrying is safe.
  await Comment.deleteMany({ _id: { $in: record.comments } });
  await record.deleteOne();
}
router.delete("/:id", m.checkCampgroundOwnership, async (req, res) => {
  await deleteCampground(req.campground);
  req.flash("success", "Campground deleted.");
  res.redirect("/campgrounds");
});
module.exports = router;
module.exports.deleteCampground = deleteCampground;
module.exports.searchFilter = searchFilter;
