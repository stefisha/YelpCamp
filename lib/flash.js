"use strict";
// Store one request's messages in the session, then consume them on the next page.
module.exports = function flash(req, res, next) {
  req.flash = function (type, message) {
    req.session.notices ||= {};
    if (message !== undefined) {
      req.session.notices[type] ||= [];
      return req.session.notices[type].push(String(message));
    }
    const messages = req.session.notices[type] || [];
    delete req.session.notices[type];
    return messages;
  };
  next();
};
