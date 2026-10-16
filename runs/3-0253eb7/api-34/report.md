# Calls on Android 14 (API 34)

WebView: com.google.android.webview, 113.0.5672.136

## PASS - First call while Priya is offline, allowing the microphone (the phone stopped the app; tried again)

Stopped: `timed out after 60s waiting for the app page after pairing (the app is not running)`


![01-stopped.png](01-stopped.png)

## PASS - First call while Priya is offline, allowing the microphone

- ok  the call screen says Priya is not online - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service runs in the foreground - `{"running":true,"foreground":true}`
- ok  the "Call in progress" notification is up
- ok  the call service has stopped
- ok  the notification has gone
- ok  the app is still open - `{"pidBefore":"","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 111.7s tap Call - `"pressed Call"`
- 114.6s tap "While using the app"
- 118.8s tap Cancel - `"pressed Cancel call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [first-call-while-priya-is-offline-allowing-the-mic.log](first-call-while-priya-is-offline-allowing-the-mic.log)

## PASS - Call while Priya is offline rings out

- ok  the call service runs in the foreground
- ok  after 45 seconds it says No answer - `"END-TO-END ENCRYPTED Y P Partner No answer They will see that you called."`
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 125.2s tap Call - `"pressed Call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## PASS - Call cancelled straight away, ten times

- ok  no call service left running
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 178.1s Call, then Cancel after 0 ms - `true`
- 181.7s Call, then Cancel after 20 ms - `true`
- 185.3s Call, then Cancel after 40 ms - `true`
- 189.0s Call, then Cancel after 60 ms - `true`
- 192.6s Call, then Cancel after 90 ms - `true`
- 196.3s Call, then Cancel after 120 ms - `true`
- 200.1s Call, then Cancel after 180 ms - `true`
- 203.9s Call, then Cancel after 250 ms - `true`
- 207.9s Call, then Cancel after 400 ms - `true`
- 212.1s Call, then Cancel after 700 ms - `true`

</details>

```
{
  "pageErrors": []
}
```

Log: [call-cancelled-straight-away-ten-times.log](call-cancelled-straight-away-ten-times.log)

## PASS - Call that Priya answers, with the speaker on and off

- ok  the call connects - `"END-TO-END ENCRYPTED Y P Priya 0:00 Earpiece · 96 kbps Mute End Speaker"`
- ok  the call service runs in the foreground
- ok  still connected after six seconds
- ok  the call service has stopped
- ok  the screen lock at the ear is let go
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 223.8s tap Call - `"pressed Call"`
- 224.3s Priya sees - `"END-TO-END ENCRYPTED P D Dinesh online is calling you Decline Accept"`
- 224.3s Priya taps Accept - `"pressed Accept"`
- 225.5s tap Speaker - `"pressed Use speaker"`
- 227.3s tap Speaker again - `"pressed Use earpiece"`
- 230.7s tap End - `"pressed End call"`
- 233.7s Priya sees - `""`

</details>

```
{
  "audioAtEar": [
    "10-16 12:24:27:721 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:27:721 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:31:608 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:31:608 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:35:532 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:35:532 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:47:923 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:47:923 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/6382"
  ],
  "proximityAtEar": true,
  "audioOnSpeaker": [
    "10-16 12:24:31:608 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:31:608 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:35:532 setCommunicationRouteForClient for pid: 6382 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/6382",
    "10-16 12:24:35:532 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:1
```

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## PASS - Priya calls and you answer

- ok  your phone rings - `"END-TO-END ENCRYPTED Y P Priya online is calling you Decline Accept"`
- ok  the call service runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 240.1s Priya taps Call - `"pressed Call"`
- 240.8s tap Accept - `"pressed Accept"`
- 245.6s Priya taps End - `"pressed End call"`
- 248.6s you see - `""`

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
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 253.3s tap Call - `"pressed Call"`
- 254.4s press the power button
- 267.1s tap End - `"pressed End call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## PASS - Choosing a photo opens the picker

- ok  Android's picker is open - `"topResumedActivity=ActivityRecord{667bb5a u0 com.google.android.providers.media.module/com.android.providers.media.photopicker.PhotoPickerGetContentActivity t9}"`
- ok  back in the chat
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 273.3s tap Send a photo - `"pressed Send a photo"`

</details>

```
{
  "pageErrors": []
}
```

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## FAIL - Taking a photo opens the camera

- NO  back in the chat - `"topResumedActivity=ActivityRecord{7f4e5c6 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t7}"`
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

<details><summary>Steps</summary>

- 283.2s tap Take a photo - `"clicked the camera input"`
- 288.2s on screen - `"topResumedActivity=ActivityRecord{7f4e5c6 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t7}"`

</details>

![15-camera.png](15-camera.png)

Log: [taking-a-photo-opens-the-camera.log](taking-a-photo-opens-the-camera.log)

## FAIL - The page's own process crashing leaves the app open

Stopped: `timed out after 15s waiting for the last call screen to close (Runtime.evaluate timed out)`

- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"6382"}`

![16-stopped.png](16-stopped.png)

Log: [the-page-s-own-process-crashing-leaves-the-app-ope.log](the-page-s-own-process-crashing-leaves-the-app-ope.log)

## PASS - Call when you don't allow the microphone

- ok  the call screen says the microphone is not allowed - `"END-TO-END ENCRYPTED Y P Priya Microphone not allowed Allow microphone access for Two in your phone settings, then try again."`
- ok  no call service started
- ok  the app is still open - `{"pidBefore":"6382","pidAfter":"7554"}`

<details><summary>Steps</summary>

- 414.5s tap Call - `"pressed Call"`
- 416.9s tap Don't allow

</details>

```
{
  "pageErrors": []
}
```

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
