/** @format */

import { createHash, randomBytes } from 'node:crypto';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
    NAVIDROME_URL,
    ND_USERNAME,
    ND_PASSWORD,
    PLAYLIST_NAME,
    NAVIDROME_ROOT,
    MUSICBEE_ROOT,
    OUTPUT_M3U,
    FETCH_TIMEOUT_MS
} from '../utils/config.js';

const CLIENT = 'nd-m3u-bridge';
const API_VERSION = '1.16.1';

function authParams() {
    const salt = randomBytes(8).toString('hex');
    const token = createHash('md5')
        .update(ND_PASSWORD + salt)
        .digest('hex');
    return {
        u: ND_USERNAME,
        t: token,
        s: salt,
        v: API_VERSION,
        c: CLIENT,
        f: 'json'
    };
}

async function call(endpoint, extra = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const params = new URLSearchParams({ ...authParams(), ...extra });
        const res = await fetch(`${NAVIDROME_URL}/rest/${endpoint}?${params}`, {
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
        const sub = (await res.json())['subsonic-response'];
        if (sub.status !== 'ok') {
            throw new Error(
                `Subsonic error ${sub.error?.code}: ${sub.error?.message}`
            );
        }
        return sub;
    } finally {
        clearTimeout(timer);
    }
}

const asList = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function findPlaylistId(name) {
    const sub = await call('getPlaylists');
    for (const pl of asList(sub.playlists?.playlist)) {
        if (pl.name === name) return pl.id;
    }
    throw new Error(`Playlist '${name}' not found on Navidrome`);
}

async function getEntries(pid) {
    const sub = await call('getPlaylist', { id: String(pid) });
    return asList(sub.playlist?.entry);
}

// Handles both forms: full container path (/music/Artist/...) or library-relative (Artist/...).
function translate(navPath) {
    let p = navPath;
    if (p.startsWith(NAVIDROME_ROOT)) p = p.slice(NAVIDROME_ROOT.length);
    p = p.replace(/^\/+/, '');
    return MUSICBEE_ROOT + p.replaceAll('/', '\\');
}

async function writeM3u(entries, outPath) {
    const lines = ['#EXTM3U'];
    for (const e of entries) {
        const navPath = e.path ?? '';
        if (!navPath) {
            console.log(`  ! skipping entry with no path: ${e.title ?? '?'}`);
            continue;
        }
        const duration = parseInt(e.duration ?? 0, 10) || 0;
        lines.push(`#EXTINF:${duration},${e.artist ?? ''} - ${e.title ?? ''}`);
        lines.push(translate(navPath));
    }
    // Atomic write, CRLF + UTF-8 for a Windows-bound file.
    const tmp = `${outPath}.tmp`;
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(tmp, lines.join('\r\n') + '\r\n', 'utf-8');
    await rename(tmp, outPath);
}

/**
 * @returns {{ tracksWritten: number }}
 */
export async function runSync() {
    const pid = await findPlaylistId(PLAYLIST_NAME);
    const entries = await getEntries(pid);
    console.log(`Pulled ${entries.length} track(s) from '${PLAYLIST_NAME}'.`);

    if (entries.length) {
        const first = entries[0].path ?? '';
        console.log(`  navidrome: ${first}`);
        console.log(`  musicbee:  ${translate(first)}`);
    }

    await writeM3u(entries, OUTPUT_M3U);
    console.log(`Wrote ${OUTPUT_M3U}`);
    return { tracksWritten: entries.length };
}
