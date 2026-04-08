/**
 * Generate Apple client_secret JWT for Supabase Apple OAuth.
 *
 * Usage:
 *   node scripts/generate-apple-secret.mjs \
 *     --team-id BAF64742AZ \
 *     --client-id com.morak.inputenglish.web \
 *     --key-id <YOUR_KEY_ID> \
 *     --key-file /path/to/AuthKey_XXXXXX.p8
 */
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "team-id": { type: "string" },
    "client-id": { type: "string" },
    "key-id": { type: "string" },
    "key-file": { type: "string" },
  },
});

const teamId = values["team-id"];
const clientId = values["client-id"];
const keyId = values["key-id"];
const keyFile = values["key-file"];

if (!teamId || !clientId || !keyId || !keyFile) {
  console.error(
    "Usage: node generate-apple-secret.mjs --team-id X --client-id X --key-id X --key-file X",
  );
  process.exit(1);
}

// Build JWT header + payload
const header = { alg: "ES256", kid: keyId };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: teamId,
  iat: now,
  exp: now + 15777000, // ~6 months (Apple max)
  aud: "https://appleid.apple.com",
  sub: clientId,
};

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64url");
}

const unsignedToken = `${base64url(header)}.${base64url(payload)}`;

// Sign with .p8 private key
const pem = readFileSync(keyFile, "utf8");
const key = createPrivateKey({ key: pem, format: "pem" });
const signature = sign("sha256", Buffer.from(unsignedToken), {
  key,
  dsaEncoding: "ieee-p1363",
});

const jwt = `${unsignedToken}.${signature.toString("base64url")}`;

console.log("\n=== Apple Client Secret (JWT) ===\n");
console.log(jwt);
console.log("\n=== Expires ===");
console.log(new Date((now + 15777000) * 1000).toISOString());
console.log("\nCopy the JWT above and paste it into Supabase > Auth > Apple > Secret Key\n");
