# navidrome-m3u-bridge

Polls a Navidrome playlist on a configurable interval and writes an M3U8 file
that MusicBee can read directly. Designed to run as a Docker container on
Unraid.

It only **reads** from Navidrome — the playlist is never modified. You stay in
control of when to clear the inbox in the Navidrome UI.

---

## How it works

1. Connects to your Navidrome server via the Subsonic API
2. Finds the configured playlist by name
3. Translates each track's path from the Linux filesystem Navidrome sees to the
   Windows path MusicBee expects
4. Writes an M3U8 file atomically (write to `.tmp`, then rename) to prevent
   MusicBee from reading a partial file
5. Sleeps for the configured interval, then repeats

---

## Configuration

Copy `.env.example` to `.env` and fill in your values.

| Variable                | Required | Default                | Description                                                                                           |
| ----------------------- | -------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `NAVIDROME_URL`         | Yes      | —                      | Base URL of your Navidrome instance, no trailing slash                                                |
| `ND_USERNAME`           | Yes      | —                      | Navidrome username                                                                                    |
| `ND_PASSWORD`           | Yes      | —                      | Navidrome password (use Docker secrets or env injection — don't commit this)                          |
| `OUTPUT_M3U`            | Yes      | —                      | Absolute path where the M3U8 file should be written, e.g. `/mnt/user/Media/Playlists/iPod Inbox.m3u8` |
| `PLAYLIST_NAME`         | No       | `From Navidrome`       | Name of the Navidrome playlist to mirror                                                              |
| `NAVIDROME_ROOT`        | No       | `/music/`              | The root path Navidrome serves music from                                                             |
| `MUSICBEE_ROOT`         | No       | `M:\Audio\Collection\` | The root path MusicBee sees the same files at                                                         |
| `SYNC_INTERVAL_SECONDS` | No       | `3600`                 | How often to sync, in seconds                                                                         |
| `FETCH_TIMEOUT_MS`      | No       | `10000`                | HTTP timeout for Navidrome API calls, in milliseconds                                                 |
| `PORT`                  | No       | `3000`                 | Port for the health endpoint                                                                          |

---

## Running with Docker

```bash
docker build -t navidrome-m3u-bridge .

docker run -d \
  --name navidrome-m3u-bridge \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /mnt/user/Media/Playlists:/mnt/user/Media/Playlists \
  -e NAVIDROME_URL=https://navidrome.example.com \
  -e ND_USERNAME=evan \
  -e ND_PASSWORD=your-password \
  -e OUTPUT_M3U=/mnt/user/Media/Playlists/iPod\ Inbox.m3u8 \
  navidrome-m3u-bridge
```

The volume mount must expose whatever path `OUTPUT_M3U` points to inside the
container.

---

## Health endpoint

`GET /health` — used for uptime monitoring (e.g. Gatus).

| State      | HTTP Status | When                                          |
| ---------- | ----------- | --------------------------------------------- |
| `starting` | `503`       | Container booted, first sync not yet complete |
| `ok`       | `200`       | Last sync succeeded                           |
| `error`    | `500`       | Last sync failed                              |

Example response:

```json
{
    "status": "ok",
    "lastSync": "2026-06-23T14:00:00.000Z",
    "tracksWritten": 12,
    "lastError": null,
    "nextSync": "2026-06-23T15:00:00.000Z"
}
```

### Gatus config example

```yaml
endpoints:
    - name: navidrome-m3u-bridge
      url: http://navidrome-m3u-bridge:3000/health
      interval: 5m
      conditions:
          - '[STATUS] == 200'
          - '[BODY].status == ok'
```

---

## Path translation

Navidrome serves music from a Linux path (e.g.
`/music/Artist/Album/track.flac`). MusicBee on Windows sees the same share at a
different path (e.g. `M:\Audio\Collection\Artist\Album\track.flac`). The bridge
strips `NAVIDROME_ROOT` and prepends `MUSICBEE_ROOT`, converting forward slashes
to backslashes.

On each sync run the first translated path is printed to the log so you can
verify the mapping is correct:

```
navidrome: /music/Artist/Album/track.flac
musicbee:  M:\Audio\Collection\Artist\Album\track.flac
```

---

## Development

```bash
pnpm install
cp .env.example .env  # fill in your values
pnpm start
```

Requires Node 24+.

---

## AI Disclaimer

This project was built with the assistance of [Claude](https://claude.ai)
(Anthropic). The core sync script was designed by Claude Opus, which worked out
the Subsonic API auth flow, the atomic M3U write pattern, and the path
translation logic. Claude Sonnet (via [Claude Code](https://claude.ai/code))
then helped restructure it into a deployable Docker app — stripping an Express
template down to just what was needed, wiring up the polling loop and health
endpoint, and addressing a follow-up security review (fetch timeouts, graceful
shutdown, and readiness signaling).

The code was reviewed and directed by the project owner throughout.
