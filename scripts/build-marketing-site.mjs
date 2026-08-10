import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("public/marketing");
const output = resolve("dist");
const marketingOutput = resolve(output, "marketing");

await rm(output, { force: true, recursive: true });
await mkdir(marketingOutput, { recursive: true });
await cp(source, marketingOutput, { recursive: true });
await cp(resolve(source, "index.html"), resolve(output, "index.html"));

console.log("Built static JewelHire marketing site in dist/.");
