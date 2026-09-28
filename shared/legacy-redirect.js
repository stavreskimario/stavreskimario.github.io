"use strict";
// Compatibility entrypoints only; the apps themselves live under apps/.
const destination = new URL(document.querySelector("[data-app-redirect]").href);
destination.search = location.search;
destination.hash = location.hash;
location.replace(destination.href);
