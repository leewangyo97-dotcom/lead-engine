import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { countryExtract, fetchGeofabrikIndex } from "./geofabrik";
import { OSM_USER_AGENT } from "./nominatim";
import { OSM_CATEGORIES, type PlaceCategory } from "./osm-categories";
import { toRawPlace } from "./overpass";
import type { RawPlace } from "./types";

/**
 * A whole-country search from a Geofabrik extract, filtered by osmium-tool.
 *
 * Overpass answers a country one category at a time, and the free server
 * shares its slots: Canada took over half an hour for four categories (17
 * Oct). Here the country is downloaded once and every category is read from
 * it in a single pass, on the machine.
 *
 * Kept the same as an Overpass area search, so the rows are the same rows:
 *  - the same tags (OSM_CATEGORIES) on nodes, ways and relations;
 *  - clipped to the country's own boundary relation, read from the extract,
 *    which is what `area(...)` means to Overpass; Geofabrik's cut lines are
 *    buffered and take in some of the neighbours;
 *  - a way or relation at the centre of its bounding box, as `out center`;
 *  - every element through the same `toRawPlace`.
 * The download is checked against Geofabrik's published MD5. Any failure
 * throws, and the caller falls back to Overpass.
 */
export const OSMIUM_IMAGE = "lead-engine-osmium";

export function tagFilters(categories: PlaceCategory[]): string[] {
  return [...new Set(categories.flatMap((c) => OSM_CATEGORIES[c].map(([k, v]) => `nwr/${k}=${v}`)))];
}

interface Runner {
  run(args: string[]): Promise<void>;
  /** A file in the work directory, as osmium sees it. */
  path(name: string): string;
}

/** osmium on the machine, or in Docker (tools/osmium) with OSMIUM_DOCKER=1, as on Windows. */
function runner(workDir: string, env: Record<string, string | undefined>): Runner {
  const docker = env.OSMIUM_DOCKER === "1";
  return {
    path: (name) => (docker ? `/work/${name}` : join(workDir, name)),
    run: (args) =>
      new Promise((resolve, reject) => {
        const [cmd, full] = docker
          ? ["docker", ["run", "--rm", "-v", `${workDir}:/work`, OSMIUM_IMAGE, "osmium", ...args]]
          : ["osmium", args];
        const child = spawn(cmd, full, { stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (d) => (stderr += String(d)));
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`osmium ${args[0]} failed: ${stderr.trim().slice(-300)}`)),
        );
      }),
  };
}

/** Whether osmium can run here: installed, or in Docker when asked for (building the image once). */
export function osmiumAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.OSMIUM_DOCKER === "1") {
    if (spawnSync("docker", ["info"]).status !== 0) return false;
    if (spawnSync("docker", ["image", "inspect", OSMIUM_IMAGE]).status === 0) return true;
    return spawnSync("docker", ["build", "-t", OSMIUM_IMAGE, "tools/osmium"], { stdio: "inherit" }).status === 0;
  }
  return spawnSync("osmium", ["--version"]).status === 0;
}

/** Streams the extract to disk, hashing as it goes, and refuses one that does not match Geofabrik's MD5. */
async function download(url: string, file: string): Promise<number> {
  const expected = (await (await fetch(`${url}.md5`, { headers: { "User-Agent": OSM_USER_AGENT } })).text())
    .trim()
    .split(/\s+/)[0];
  const res = await fetch(url, { headers: { "User-Agent": OSM_USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`${url} returned ${res.status}`);
  const hash = createHash("md5");
  const tap = new Transform({
    transform(chunk, _enc, done) {
      hash.update(chunk);
      done(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as never), tap, createWriteStream(file));
  const actual = hash.digest("hex");
  if (!/^[0-9a-f]{32}$/.test(expected) || actual !== expected) {
    throw new Error(`the extract did not match its checksum (${actual} vs ${expected || "none published"})`);
  }
  return statSync(file).size;
}

type Position = number[];
type Geometry = { type: string; coordinates: unknown };

/** The centre of a geometry's bounding box: what Overpass's `out center` gives a way or relation. */
export function bboxCenter(geometry: Geometry): { lat: number; lon: number } | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [lon, lat] = c as Position;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geometry.coordinates);
  return Number.isFinite(minLon) ? { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 } : null;
}

/** One GeoJSON feature from `osmium export -a type,id`, in the shape Overpass returns. */
export function featureToElement(feature: {
  geometry: Geometry;
  properties: Record<string, unknown>;
}): { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> } | null {
  const { "@type": type, "@id": id, ...rest } = feature.properties;
  if (type !== "node" && type !== "way" && type !== "relation") return null;
  const tags = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v)]));
  if (type === "node" && feature.geometry.type === "Point") {
    const [lon, lat] = feature.geometry.coordinates as Position;
    return { type, id: Number(id), lat, lon, tags };
  }
  const center = bboxCenter(feature.geometry);
  return center ? { type, id: Number(id), center, tags } : null;
}

export async function countryPlaces(input: {
  countryCode: string;
  osmId: number;
  categories: PlaceCategory[];
  log?: (line: string) => void;
  env?: Record<string, string | undefined>;
  workDir?: string;
}): Promise<RawPlace[]> {
  const env = input.env ?? process.env;
  const log = input.log ?? (() => {});
  const workDir = input.workDir ?? join(env.RUNNER_TEMP ?? env.TEMP ?? "/tmp", `geofabrik-${input.countryCode}-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const r = runner(workDir, env);
  const started = Date.now();
  const seconds = () => `${Math.round((Date.now() - started) / 1000)}s`;

  try {
    const extract = countryExtract(await fetchGeofabrikIndex(), input.countryCode);
    if (!extract) throw new Error(`Geofabrik has no extract for ${input.countryCode}`);
    const size = await download(extract.pbf, join(workDir, "country.osm.pbf"));
    log(`Geofabrik ${extract.id}: ${(size / 1e6).toFixed(0)} MB downloaded and checked (${seconds()})`);

    // The country's own boundary, from the relation Nominatim named.
    await r.run(["getid", "-r", "--overwrite", "-o", r.path("boundary.osm.pbf"), r.path("country.osm.pbf"), `r${input.osmId}`]);
    await r.run([
      "export", "--overwrite", "-a", "type,id", "--geometry-types=polygon",
      "-o", r.path("boundary.geojson"), r.path("boundary.osm.pbf"),
    ]);
    const boundary = (JSON.parse(readFileSync(join(workDir, "boundary.geojson"), "utf8")) as {
      features: { properties: Record<string, unknown> }[];
    }).features.find((f) => f.properties["@type"] === "relation" && Number(f.properties["@id"]) === input.osmId);
    if (!boundary) throw new Error("the country's boundary is not complete in the extract");
    writeFileSync(join(workDir, "country.geojson"), JSON.stringify({ type: "FeatureCollection", features: [boundary] }));

    // Every category in one pass, then only what is inside the boundary.
    await r.run([
      "tags-filter", "--overwrite", "-o", r.path("tagged.osm.pbf"), r.path("country.osm.pbf"),
      ...tagFilters(input.categories),
    ]);
    await r.run([
      "extract", "--overwrite", "-s", "smart", "-p", r.path("country.geojson"),
      "-o", r.path("inside.osm.pbf"), r.path("tagged.osm.pbf"),
    ]);
    await r.run([
      "export", "--overwrite", "-a", "type,id", "-f", "geojsonseq", "-x", "print_record_separator=false",
      "-o", r.path("places.geojsonseq"), r.path("inside.osm.pbf"),
    ]);

    const found = new Map<string, RawPlace>();
    for (const line of readFileSync(join(workDir, "places.geojsonseq"), "utf8").split("\n")) {
      if (!line.trim()) continue;
      const element = featureToElement(JSON.parse(line));
      const place = element && toRawPlace(element, input.categories);
      if (place) found.set(place.sourceId, place);
    }
    log(`osmium: ${found.size} places in ${input.categories.length} categories (${seconds()})`);
    return [...found.values()];
  } finally {
    if (env.KEEP_EXTRACT !== "1") rmSync(workDir, { recursive: true, force: true });
  }
}
