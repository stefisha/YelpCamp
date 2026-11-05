"use strict";
const search = document.querySelector("#search");
const list = document.querySelector("#campsList");
const status = document.querySelector("#search-status");
let timer;
let activeRequest;
function card(campground) {
  const column = document.createElement("div");
  column.className = "col-md-3 col-sm-6";
  const frame = document.createElement("div");
  frame.className = "img-thumbnail";
  const image = document.createElement("img");
  image.src = campground.image;
  image.alt = campground.name;
  image.loading = "lazy";
  image.className = "w-100";
  const caption = document.createElement("div");
  caption.className = "caption";
  const heading = document.createElement("h4");
  heading.textContent = campground.name;
  caption.append(heading);
  const paragraph = document.createElement("p");
  const link = document.createElement("a");
  link.className = "btn btn-primary";
  link.href = `/campgrounds/${encodeURIComponent(campground._id)}`;
  link.textContent = "More info";
  paragraph.append(link);
  frame.append(image, caption, paragraph);
  column.append(frame);
  return column;
}
if (search && list)
  search.addEventListener("input", () => {
    clearTimeout(timer);
    activeRequest?.abort();
    timer = setTimeout(async () => {
      const controller = new AbortController();
      activeRequest = controller;
      status.textContent = "Searching…";
      try {
        const response = await fetch(
          `/campgrounds/searching?${new URLSearchParams({ search: search.value })}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const campgrounds = await response.json();
        if (controller.signal.aborted) return;
        list.replaceChildren(...campgrounds.map(card));
        status.textContent = campgrounds.length
          ? `${campgrounds.length} ${campgrounds.length === 1 ? "campground" : "campgrounds"} shown`
          : "No campgrounds found.";
      } catch (error) {
        if (error.name !== "AbortError")
          status.textContent = "Search is unavailable. Please try again.";
      }
    }, 250);
  });
