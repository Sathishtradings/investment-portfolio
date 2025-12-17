/**
 * scripts/importNseExcel.js
 *
 * Reads data/nse_master.xlsx (first sheet),
 * maps common NSE headers to { symbol, name, isin },
 * upserts rows into Supabase public.symbols,
 * optionally writes public/symbols.json for quick dev use.
 *
 * Usage:
 *   node scripts/importNseExcel.js
 *
 * Edit COLUMN_MAP below if your file headers differ.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const inputFile = path.resolve("data", "nse_master.xlsx");
const outputPublicJson = path.resolve("public", "symbols.json"); // optional export
if (!fs.existsSync(inputFile)) {
  console.error("Excel file not found at", inputFile);
  process.exit(1);
}

/**
 * Map common Excel headers (case-insensitive) to our target keys.
 * Edit this object to match your file's header text exactly if needed.
 */
const COLUMN_MAP = {
  // symbol variations
  "symbol": "symbol",
  "scrip": "symbol",
  "scrip code": "symbol",
  "tradingsymbol": "symbol",
  "sc_code": "symbol",

  // name variations
  "name of company": "name",
  "security name": "name",
  "company name": "name",
  "issuer name": "name",
  "company": "name",

  // isin variations
  "isin number": "isin",
  "isin": "isin",
  "isin code": "isin",

  // optional extras (map if present)
  "series": "series",
  "industry": "industry",
  "industry type": "industry"
};

function mapHeader(rawHeader) {
  if (!rawHeader) return null;
  return COLUMN_MAP[rawHeader.toString().trim().toLowerCase()] || null;
}

function rowToObject(row, headerMap) {
  const out = {};
  for (const [colHeader, mappedKey] of Object.entries(headerMap)) {
    if (!mappedKey) continue;
    const val = row[colHeader];
    if (val === undefined || val === null) continue;
    out[mappedKey] = String(val).trim();
  }
  return out;
}

async function main() {
  console.log("Reading Excel:", inputFile);
  const workbook = XLSX.readFile(inputFile);
  const sheetName = workbook.SheetNames[0];
  console.log("Using sheet:", sheetName);
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // array of row objects, keys are headers

  if (!jsonRows || jsonRows.length === 0) {
    console.error("No rows found in the sheet.");
    process.exit(1);
  }

  // build header map: actual header text -> mapped key
  const sampleHeaders = Object.keys(jsonRows[0]);
  const headerMap = {};
  for (const h of sampleHeaders) {
    headerMap[h] = mapHeader(h);
  }
  console.log("Detected headers (first row):", sampleHeaders);
  console.log("Header mapping ->", headerMap);

  // transform rows
  const rows = jsonRows.map(r => rowToObject(r, headerMap)).filter(r => r && (r.symbol || r.name));

  console.log("Parsed rows:", rows.length);
  const missingSymbol = rows.filter(r => !r.symbol).length;
  const missingName = rows.filter(r => !r.name).length;
  console.log(`Missing symbol: ${missingSymbol}, Missing name: ${missingName}`);
  if (missingSymbol > 0) {
    console.warn("Some rows lack a symbol. Edit COLUMN_MAP to match your header names.");
  }

  // Prepare upsert rows
  const uploadRows = rows.map(r => ({
    symbol: (r.symbol || "").toString().toUpperCase(),
    name: (r.name || "").toString(),
    isin: r.isin || null,
    exchange: r.series || null,
    instrument_type: null,
    metadata: {}
  }));

  // Upsert in chunks
  const chunkSize = 500;
  for (let i = 0; i < uploadRows.length; i += chunkSize) {
    const chunk = uploadRows.slice(i, i + chunkSize);
    console.log(`Upserting rows ${i + 1}..${i + chunk.length}`);
    const { error } = await supabase
      .from("symbols")
      .upsert(chunk, { onConflict: ["symbol"] });
    if (error) {
      console.error("Upsert error:", error);
      process.exit(1);
    }
  }

  console.log("Upsert complete. Total rows upserted:", uploadRows.length);

  // Optionally export to public/symbols.json for local dev usage (autocomplete from file)
  try {
    const publicData = uploadRows.map(r => ({ symbol: r.symbol, name: r.name, exchange: r.exchange || null }));
    fs.mkdirSync(path.resolve("public"), { recursive: true });
    fs.writeFileSync(outputPublicJson, JSON.stringify(publicData, null, 2), "utf8");
    console.log("Wrote public JSON:", outputPublicJson);
  } catch (err) {
    console.warn("Could not write public JSON:", err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
