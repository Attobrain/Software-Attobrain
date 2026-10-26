"use strict";
const POLICY = Object.freeze({ version: "engineering-2.0", minActiveMs: 30000, coverage: .8, minWindows: 40, windowMs: 500, rateMs: 60000, thirdsMs: 45000, thirdValidMs: 15000, recoveries: 3, efficiencyPoints: 5, relative: .1, patternRelative: .2 });
module.exports = { POLICY };
