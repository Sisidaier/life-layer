# iPhone PWA path

## Runtime architecture

```text
iPhone home-screen PWA
  -> hosted Life Layer backend
  -> DeepSeek JSON intent
  -> confirmation card
  -> shortcuts:// Life Layer Bridge
  -> Apple Calendar / Reminders on the iPhone
  -> callback to the PWA
```

The Mac is needed for development and deployment only. It does not need to stay online after the app is hosted.

## Install on iPhone

1. Open the production HTTPS URL in Safari.
2. Tap Share.
3. Tap “Add to Home Screen”.
4. Keep the name “小橘历” and tap Add.
5. Launch 小橘历 from the new home-screen icon.

The current local URL (`127.0.0.1`) cannot be installed or reached from the phone. Complete the hosted deployment first.

## Network boundary

- The iPhone needs internet access for DeepSeek and the hosted API.
- The Mac can be switched off.
- A cached app shell can open without a network connection, but DeepSeek parsing will be unavailable while the iPhone is offline.
- Calendar and Reminders mutations happen locally through the iPhone Shortcut.

## Remaining Golden Path work

1. Deploy the PWA and API over HTTPS.
2. Store `DEEPSEEK_API_KEY` as a hosted secret.
3. Create and install the `Life Layer Bridge` Shortcut on iPhone.
4. Install the Shortcut on the iPhone using the documented JSON contract.
5. Set hosted execution mode to `shortcut`.
6. Verify one real Calendar create action from the home-screen PWA.

## Hosted execution variables

```text
LIFE_LAYER_EXECUTION_MODE=shortcut
NEXT_PUBLIC_LIFE_LAYER_EXECUTION_MODE=shortcut
NEXT_PUBLIC_LIFE_LAYER_SHORTCUT_NAME=Life Layer Bridge
```

In shortcut mode, the API only parses intent. The browser keeps the action history locally and the iPhone Shortcut performs the Apple mutation.
