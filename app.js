"use strict";
const previousRoute = location.hash.slice(1);
const target = ["students", "create", "edit", "delete"].includes(previousRoute.split("/")[0]) ? "students" : previousRoute === "overview" ? "overview" : ["result", "results"].includes(previousRoute) ? "results" : "session";
location.replace(`/${location.hash ? `#${target}` : "#overview"}`);
