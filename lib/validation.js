"use strict";
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function text(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(
      400,
      `${name} is required and must be at most ${max} characters.`,
    );
  }
  return value.trim();
}
function campgroundInput(body) {
  const name = text(body?.name, "Name", 120);
  const description = text(body?.description, "Description", 5000);
  const image = text(body?.image, "Image URL", 2000);
  try {
    if (new URL(image).protocol !== "https:") throw new Error();
  } catch {
    throw new HttpError(400, "Image URL must be a valid HTTPS URL.");
  }
  if (
    !["string", "number"].includes(typeof body.price) ||
    String(body.price).trim() === "" ||
    !Number.isFinite(Number(body.price)) ||
    Number(body.price) < 0 ||
    Number(body.price) > 100000
  ) {
    throw new HttpError(400, "Price must be a number between 0 and 100000.");
  }
  return { name, description, image, price: Number(body.price).toFixed(2) };
}
module.exports = { HttpError, text, campgroundInput };
