/**
 * Load US Census TIGER/Line boundary data into Supabase jurisdictions table.
 *
 * Downloads GeoJSON boundaries for US states, counties, and places, then
 * updates existing jurisdiction rows with boundary, centroid, and
 * boundary_simplified geometry columns.
 *
 * Usage:
 *   npx tsx scripts/load-boundaries.ts [--states] [--counties] [--places]
 *   npx tsx scripts/load-boundaries.ts --all
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Data source: US Census Bureau Cartographic Boundary Files (500k resolution)
 * License: Public domain
 * Format: GeoJSON
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Census Bureau Cartographic Boundary Files (500k resolution, GeoJSON)
const CENSUS_URLS = {
  states: 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip',
  counties: 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip',
  places: 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_place_500k.zip',
};

// For now, we use pre-converted GeoJSON files in data/boundaries/
// The conversion step (shapefile -> GeoJSON) can be done with ogr2ogr:
//   ogr2ogr -f GeoJSON states.geojson cb_2024_us_state_500k.shp

const DATA_DIR = path.resolve(process.cwd(), 'data', 'boundaries');

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, string | number | null>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

async function loadGeoJSON(filename: string): Promise<GeoJSONCollection | null> {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`File not found: ${filepath}`);
    console.warn(`Download and convert Census TIGER data first.`);
    console.warn(`See: ${CENSUS_URLS.states}`);
    return null;
  }
  const raw = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(raw) as GeoJSONCollection;
}

async function updateBoundary(
  jurisdictionId: string,
  geometry: GeoJSONFeature['geometry'],
  name: string
): Promise<boolean> {
  const geojsonStr = JSON.stringify(geometry);

  // Use raw SQL via RPC to call PostGIS functions
  const { error } = await supabase.rpc('update_jurisdiction_boundary', {
    p_jurisdiction_id: jurisdictionId,
    p_geojson: geojsonStr,
  });

  if (error) {
    // Fallback: try direct update (boundary column accepts GeoJSON text in some Supabase configs)
    console.warn(`RPC failed for ${name}: ${error.message}. Skipping.`);
    return false;
  }

  console.log(`  Updated: ${name}`);
  return true;
}

async function loadStates(): Promise<void> {
  console.log('\n--- Loading US State Boundaries ---');
  const geojson = await loadGeoJSON('states.geojson');
  if (!geojson) return;

  let updated = 0;
  for (const feature of geojson.features) {
    const fipsCode = feature.properties.STATEFP as string;
    const name = feature.properties.NAME as string;

    // Find jurisdiction by FIPS code
    const { data } = await supabase
      .from('jurisdictions')
      .select('id, name')
      .eq('fips_code', fipsCode)
      .maybeSingle();

    if (data) {
      const success = await updateBoundary(data.id, feature.geometry, name);
      if (success) updated++;
    }
  }
  console.log(`States: ${updated}/${geojson.features.length} matched and updated`);
}

async function loadCounties(): Promise<void> {
  console.log('\n--- Loading US County Boundaries ---');
  const geojson = await loadGeoJSON('counties.geojson');
  if (!geojson) return;

  let updated = 0;
  for (const feature of geojson.features) {
    const stateFips = feature.properties.STATEFP as string;
    const countyFips = feature.properties.COUNTYFP as string;
    const fullFips = `${stateFips}${countyFips}`;
    const name = feature.properties.NAME as string;

    const { data } = await supabase
      .from('jurisdictions')
      .select('id, name')
      .eq('fips_code', fullFips)
      .maybeSingle();

    if (data) {
      const success = await updateBoundary(data.id, feature.geometry, `${name} County`);
      if (success) updated++;
    }
  }
  console.log(`Counties: ${updated}/${geojson.features.length} matched and updated`);
}

async function loadPlaces(): Promise<void> {
  console.log('\n--- Loading US Place/City Boundaries ---');
  const geojson = await loadGeoJSON('places.geojson');
  if (!geojson) return;

  let updated = 0;
  for (const feature of geojson.features) {
    const stateFips = feature.properties.STATEFP as string;
    const placeFips = feature.properties.PLACEFP as string;
    const fullFips = `${stateFips}${placeFips}`;
    const name = feature.properties.NAME as string;

    const { data } = await supabase
      .from('jurisdictions')
      .select('id, name')
      .eq('fips_code', fullFips)
      .maybeSingle();

    if (data) {
      const success = await updateBoundary(data.id, feature.geometry, name);
      if (success) updated++;
    }
  }
  console.log(`Places: ${updated}/${geojson.features.length} matched and updated`);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all') || args.length === 0;

  console.log('Civic Brief: Loading US Census Boundary Data');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Data directory: ${DATA_DIR}`);

  if (!fs.existsSync(DATA_DIR)) {
    console.log(`\nCreating data directory: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('\nTo load boundary data:');
    console.log('1. Download Census TIGER/Line Cartographic Boundary shapefiles');
    console.log('2. Convert to GeoJSON with ogr2ogr:');
    console.log('   ogr2ogr -f GeoJSON data/boundaries/states.geojson cb_2024_us_state_500k.shp');
    console.log('   ogr2ogr -f GeoJSON data/boundaries/counties.geojson cb_2024_us_county_500k.shp');
    console.log('   ogr2ogr -f GeoJSON data/boundaries/places.geojson cb_2024_us_place_500k.shp');
    console.log('3. Re-run this script');
    return;
  }

  if (all || args.includes('--states')) await loadStates();
  if (all || args.includes('--counties')) await loadCounties();
  if (all || args.includes('--places')) await loadPlaces();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
