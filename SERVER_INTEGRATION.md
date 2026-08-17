# Server integration note

The current TKD Score Basic server exposes Socket.IO for judge devices.

The app sends:
- `join`: `{code, role, name}`
- `score`: `{corner, points, type, judge}`
- `gamjeom`: `{corner, delta, judge}`

The server should be kept on the same tournament LAN as the judge phones, or hosted on a reachable server.

Judge connection status is driven by Socket.IO `connect` / `disconnect` events.
