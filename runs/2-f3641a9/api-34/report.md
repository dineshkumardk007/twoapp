# Calls on Android 14 (API 34)

WebView: com.google.android.webview, 113.0.5672.136

## FAIL - First call while Priya is offline, allowing the microphone

- ok  the call screen says Priya is not online - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service runs in the foreground - `{"running":true,"foreground":true}`
- ok  the "Call in progress" notification is up
- ok  the call service has stopped
- NO  the notification has gone
- ok  the app is still open - `{"pidBefore":"","pidAfter":"3010"}`

<details><summary>Steps</summary>

- 30.1s tap Call - `"pressed Call"`
- 33.9s tap "While using the app"
- 38.3s tap Cancel - `"pressed Cancel call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [first-call-while-priya-is-offline-allowing-the-mic.log](first-call-while-priya-is-offline-allowing-the-mic.log)

## FAIL - Call while Priya is offline rings out

Stopped: `the app closed while ringing`

- ok  the call service runs in the foreground
- NO  the app is still open - `{"pidBefore":"3010","pidAfter":""}`

<details><summary>Steps</summary>

- 45.2s tap Call - `"pressed Call"`

</details>

### Crash

```
(crash buffer empty)
```

```
ACTIVITY MANAGER PROCESS EXIT INFO (dumpsys activity exit-info)
Last Timestamp of Persistence Into Persistent Storage: 1970-01-01 00:00:00.000
  package: app.two.android
    Historical Process Exit for uid=10192
        ApplicationExitInfo #0:
          timestamp=2026-10-16 12:04:24.749 pid=3436 realUid=99000 packageUid=10192 definingUid=10135 user=0
          process=com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0 reason=13 (OTHER KILLS BY SYSTEM) subreason=17 (ISOLATED NOT NEEDED) status=0
          importance=300 pss=79MB rss=201MB description=isolated not needed state=empty trace=null
        ApplicationExitInfo #1:
          timestamp=2026-10-16 12:04:24.717 pid=3010 realUid=10192 packageUid=10192 definingUid=10192 user=0
          process=app.two.android reason=12 (DEPENDENCY DIED) subreason=0 (UNKNOWN) status=0
          importance=100 pss=83MB rss=233MB description=depends on provider com.google.android.gms/.fonts.provider.FontsProvider in dying proc com.google.android.gms.persistent (adj -10000) state=empty trace=null

```

![06-stopped.png](06-stopped.png)

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## FAIL - Call cancelled straight away, ten times

Stopped: `page: TypeError: Cannot read properties of null (reading 'click')
    at <anonymous>:2:62
    at <anonymous>:6:23`

- ok  the app is still open - `{"pidBefore":"","pidAfter":"5999"}`

```
{
  "pageErrors": []
}
```

Log: [call-cancelled-straight-away-ten-times.log](call-cancelled-straight-away-ten-times.log)

## FAIL - Call that Priya answers, with the speaker on and off

- ok  the call connects - `"END-TO-END ENCRYPTED Y P Priya 0:00 Earpiece · 96 kbps Mute End Speaker"`
- ok  the call service runs in the foreground
- ok  still connected after six seconds
- ok  the call service has stopped
- NO  the screen lock at the ear is let go
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"5999"}`

<details><summary>Steps</summary>

- 88.6s tap Call - `"pressed Call"`
- 90.6s Priya sees - `"END-TO-END ENCRYPTED P D Dinesh online is calling you Decline Accept"`
- 90.7s Priya taps Accept - `"pressed Accept"`
- 93.1s tap Speaker - `"pressed Use speaker"`
- 95.0s tap Speaker again - `"pressed Use earpiece"`
- 98.3s tap End - `"pressed End call"`
- 101.3s Priya sees - `""`

</details>

```
{
  "audioAtEar": [
    "mAudioModeOwner: AudioModeInfo: mMode=MODE_IN_COMMUNICATION, mPid=5999, mUid=10192",
    "10-16 12:04:58:187 setMode(MODE_IN_COMMUNICATION) from package=app.two.android pid=5999 selected mode=MODE_IN_COMMUNICATION by pid=5999",
    "10-16 12:04:00:898 setCommunicationRouteForClient for pid: 3010 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:00:898 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:12:232 setCommunicationRouteForClient for pid: 3010 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:12:232 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:57:007 setCommunicationRouteForClient for pid: 5999 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5999",
    "10-16 12:04:57:007 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5999"
  ],
  "proximityAtEar": true,
  "audioOnSpeaker": [
    "10-16 12:04:00:898 setCommunicationRouteForClient for pid: 3010 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:00:898 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:12:232 setCommunicationRouteForClient for pid: 3010 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:12:232 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/3010",
    "10-16 12:04:57:007 setCommunicationRouteForClient for pid: 5999 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5999",
   
```

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## PASS - Priya calls and you answer

- ok  your phone rings - `"END-TO-END ENCRYPTED Y P Priya online is calling you Decline Accept"`
- ok  the call service runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"5999"}`

<details><summary>Steps</summary>

- 107.9s Priya taps Call - `"pressed Call"`
- 108.5s tap Accept - `"pressed Accept"`
- 113.3s Priya taps End - `"pressed End call"`
- 116.3s you see - `""`

</details>

```
{
  "pageErrors": []
}
```

Log: [priya-calls-and-you-answer.log](priya-calls-and-you-answer.log)

## PASS - Screen turned off in the middle of a call

- ok  the app is still running with the screen off
- ok  the call is still on (Priya sees a timer)
- ok  the call service still runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"5999"}`

<details><summary>Steps</summary>

- 121.1s tap Call - `"pressed Call"`
- 122.7s press the power button
- 135.4s tap End - `"pressed End call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## PASS - Choosing a photo opens the picker

- ok  Android's picker is open - `"topResumedActivity=ActivityRecord{53ea6b6 u0 com.google.android.providers.media.module/com.android.providers.media.photopicker.PhotoPickerGetContentActivity t9}"`
- ok  back in the chat
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"5999"}`

<details><summary>Steps</summary>

- 141.7s tap Send a photo - `"pressed Send a photo"`

</details>

```
{
  "pageErrors": []
}
```

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## FAIL - Taking a photo opens the camera

- NO  back in the chat
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"5999"}`

<details><summary>Steps</summary>

- 151.5s tap Take a photo - `"no Take a photo button"`
- 156.6s on screen - `"topResumedActivity=ActivityRecord{8136528 u0 app.two.android/.MainActivity t9}"`

</details>

```
{
  "pageErrors": []
}
```

Log: [taking-a-photo-opens-the-camera.log](taking-a-photo-opens-the-camera.log)

## FAIL - Call when you don't allow the microphone

- NO  the call screen says the microphone is not allowed - `""`
- ok  no call service started
- ok  the app is still open - `{"pidBefore":"5999","pidAfter":"6837"}`

<details><summary>Steps</summary>

- 173.4s tap Call - `"pressed Call"`
- 176.5s tap Don't allow

</details>

```
{
  "pageErrors": []
}
```

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
