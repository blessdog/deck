#!/usr/bin/env node
/**
 * Set the takeaway line the TAKEAWAY key will show, before the take.
 *
 *   node obs/takeaway.mjs "Ship the foundation before the feature."
 *   node obs/takeaway.mjs            # print the current line
 *
 * Writes <record dir>/takeaway.txt; the OBS text source reads that file live,
 * so the change is on the next press with no OBS click. Any editor does the
 * same job — this exists so the line can be set from a shell or a script.
 */
import { connect } from "./lib/obs.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const line = process.argv.slice(2).join(" ").trim();
const obs = await connect();
let file;
try {
	({ recordDirectory: file } = await obs.call("GetRecordDirectory"));
} finally {
	await obs.disconnect();
}
file = join(file, "takeaway.txt");
if (line) {
	writeFileSync(file, line + "\n");
	console.log(`${file}: "${line}"`);
} else {
	console.log(`${file}: "${readFileSync(file, "utf8").trim()}"`);
}
