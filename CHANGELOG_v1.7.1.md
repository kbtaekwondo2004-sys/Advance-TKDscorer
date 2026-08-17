# TKD Judge App v1.7.1

- Added **SCAN QR TO CONNECT** on the start/join page.
- Added native QR scanning with `expo-camera` (QR-only detection).
- Scanner accepts TKD Scorer connection payloads containing the scoring server URL and 4-digit court code.
- Supports JSON, URL query parameters, `tkdscore:` links, and simple URL/code QR payloads.
- After a valid scan, the app fills the server/court fields and starts the connection automatically.
- Manual server URL + court-code connection remains available.
- Camera permission is requested only when the QR scanner is opened.
