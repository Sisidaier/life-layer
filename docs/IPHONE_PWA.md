# iPhone PWA

## Add to Home Screen

1. Open the HTTPS website in Safari.
2. Tap Share, then “Add to Home Screen”.
3. Keep the name “小橘历” and tap Add.

The home-screen app is still a website. iOS does not expose EventKit directly to an ordinary PWA, so the current PWA cannot write to the iPhone's Apple Calendar. Native EventKit support is not part of this version.

## Network requirements

- Online parsing requires access to the hosted API and the configured language model.
- A cached app shell may open while offline, but natural-language parsing will not work without the API.
- Calendar writes require the macOS local bridge in this version.
