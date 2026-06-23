/** @format */

import 'dotenv/config';

const requireEnv = (key) => {
    const val = process.env[key];
    if (!val) throw new Error(`Required env var ${key} is not set`);
    return val;
};

const parseIntWithDefault = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

export const NAVIDROME_URL = requireEnv('NAVIDROME_URL');
export const ND_USERNAME = requireEnv('ND_USERNAME');
export const ND_PASSWORD = requireEnv('ND_PASSWORD');
export const PLAYLIST_NAME = process.env.PLAYLIST_NAME ?? 'From Navidrome';

// Path translation: strip the Navidrome root, prepend the MusicBee root.
export const NAVIDROME_ROOT = process.env.NAVIDROME_ROOT ?? '/music/';
export const MUSICBEE_ROOT =
    process.env.MUSICBEE_ROOT ?? 'M:\\Audio\\Collection\\';

export const OUTPUT_M3U = requireEnv('OUTPUT_M3U');

export const SYNC_INTERVAL_SECONDS = parseIntWithDefault(
    process.env.SYNC_INTERVAL_SECONDS,
    3600
);

export const FETCH_TIMEOUT_MS = parseIntWithDefault(
    process.env.FETCH_TIMEOUT_MS,
    10000
);

export const PORT = parseIntWithDefault(process.env.PORT, 3000);
