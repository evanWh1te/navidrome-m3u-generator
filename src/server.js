/** @format */

import express from 'express';
import { runSync } from './services/create-m3u-from-navidrome.js';
import { SYNC_INTERVAL_SECONDS, PORT } from './utils/config.js';

const state = {
    status: 'starting',
    lastSync: null,
    lastError: null,
    tracksWritten: null,
    nextSync: null
};

let syncTimer = null;
let syncInFlight = null;

async function doSync() {
    console.log('[sync] Starting...');
    try {
        const { tracksWritten } = await runSync();
        state.status = 'ok';
        state.lastSync = new Date().toISOString();
        state.lastError = null;
        state.tracksWritten = tracksWritten;
        console.log(`[sync] Done — ${tracksWritten} tracks.`);
    } catch (err) {
        state.status = 'error';
        state.lastSync = new Date().toISOString();
        state.lastError = err.message;
        console.error(`[sync] Failed: ${err.message}`);
    }
}

function scheduleNext() {
    const delayMs = SYNC_INTERVAL_SECONDS * 1000;
    state.nextSync = new Date(Date.now() + delayMs).toISOString();
    syncTimer = setTimeout(timerFired, delayMs);
}

function timerFired() {
    syncTimer = null;
    syncInFlight = doSync().then(() => {
        syncInFlight = null;
        scheduleNext();
    });
}

const app = express();

app.get('/health', (_req, res) => {
    const httpStatus =
        state.status === 'error'
            ? 500
            : state.status === 'starting'
              ? 503
              : 200;
    res.status(httpStatus).json({
        status: state.status,
        lastSync: state.lastSync,
        tracksWritten: state.tracksWritten,
        lastError: state.lastError,
        nextSync: state.nextSync
    });
});

const server = app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] Sync interval: ${SYNC_INTERVAL_SECONDS}s`);
    syncInFlight = doSync().then(() => {
        syncInFlight = null;
        scheduleNext();
    });
});

async function shutdown(signal) {
    console.log(`[server] Received ${signal}, shutting down...`);
    if (syncInFlight) {
        console.log('[server] Waiting for in-flight sync...');
        await syncInFlight;
    }
    if (syncTimer) clearTimeout(syncTimer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
