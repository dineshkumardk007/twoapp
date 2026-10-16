# Calls on Android 14 (API 34)

WebView: com.google.android.webview, 113.0.5672.136

## PASS - First call while Priya is offline, allowing the microphone

- ok  the call screen says Priya is not online - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service runs in the foreground - `{"running":true,"foreground":true}`
- ok  the "Call in progress" notification is up
- ok  the call service has stopped
- ok  the notification has gone
- ok  the app is still open - `{"pidBefore":"","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 44.2s tap Call - `"pressed Call"`
- 46.7s tap "While using the app"
- 50.9s tap Cancel - `"pressed Cancel call"`

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
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 57.4s tap Call - `"pressed Call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## PASS - Call cancelled straight away, ten times

- ok  no call service left running
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 110.6s Call, then Cancel after 0 ms - `true`
- 114.1s Call, then Cancel after 20 ms - `true`
- 117.7s Call, then Cancel after 40 ms - `true`
- 121.4s Call, then Cancel after 60 ms - `true`
- 125.0s Call, then Cancel after 90 ms - `true`
- 128.8s Call, then Cancel after 120 ms - `true`
- 132.6s Call, then Cancel after 180 ms - `true`
- 136.4s Call, then Cancel after 250 ms - `true`
- 140.3s Call, then Cancel after 400 ms - `true`
- 144.5s Call, then Cancel after 700 ms - `true`

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
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 158.3s tap Call - `"pressed Call"`
- 158.8s Priya sees - `"END-TO-END ENCRYPTED P D Dinesh online is calling you Decline Accept"`
- 158.9s Priya taps Accept - `"pressed Accept"`
- 160.5s tap Speaker - `"pressed Use speaker"`
- 162.4s tap Speaker again - `"pressed Use earpiece"`
- 165.6s tap End - `"pressed End call"`
- 168.6s Priya sees - `""`

</details>

```
{
  "audioAtEar": [
    "10-16 12:41:57:212 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:41:57:212 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:01:021 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:01:021 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:04:953 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:04:953 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:19:452 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:19:452 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5015"
  ],
  "proximityAtEar": true,
  "audioOnSpeaker": [
    "10-16 12:42:01:021 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:01:021 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:04:953 setCommunicationRouteForClient for pid: 5015 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] from API: setCommunicationDevice() from u/pid:10192/5015",
    "10-16 12:42:04:953 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:1
```

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## PASS - Priya calls and you answer

- ok  your phone rings - `"END-TO-END ENCRYPTED Y P Priya online is calling you Decline Accept"`
- ok  the call service runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 175.1s Priya taps Call - `"pressed Call"`
- 175.7s tap Accept - `"pressed Accept"`
- 180.5s Priya taps End - `"pressed End call"`
- 183.5s you see - `""`

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
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 188.3s tap Call - `"pressed Call"`
- 189.3s press the power button
- 201.9s tap End - `"pressed End call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## PASS - Choosing a photo opens the picker

- ok  Android's picker is open - `"topResumedActivity=ActivityRecord{e5f877d u0 com.google.android.providers.media.module/com.android.providers.media.photopicker.PhotoPickerGetContentActivity t8}"`
- ok  back in the chat
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 208.2s tap Send a photo - `"pressed Send a photo"`

</details>

```
{
  "pageErrors": []
}
```

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## PASS - Taking a photo opens the camera

- ok  back in the chat - `"topResumedActivity=ActivityRecord{b844a9d u0 app.two.android/.MainActivity t8}"`
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 218.0s tap Take a photo - `"clicked the camera input"`
- 223.0s on screen - `"topResumedActivity=ActivityRecord{6beac00 u0 com.android.camera2/com.android.camera.CaptureActivity t8}"`

</details>

```
{
  "pageErrors": []
}
```

![14-camera.png](14-camera.png)

Log: [taking-a-photo-opens-the-camera.log](taking-a-photo-opens-the-camera.log)

## PASS - The page's own process crashing leaves the app open

- ok  the app process is still running
- ok  Settings shows a note about it
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"5015"}`

<details><summary>Steps</summary>

- 228.9s crash the page process
- 237.7s open Settings - `"ok"`

</details>

```
{
  "pageErrors": []
}
```

Log: [the-page-s-own-process-crashing-leaves-the-app-ope.log](the-page-s-own-process-crashing-leaves-the-app-ope.log)

## PASS - Call when you don't allow the microphone

- ok  the call screen says the microphone is not allowed - `"END-TO-END ENCRYPTED Y P Priya Microphone not allowed Allow microphone access for Two in your phone settings, then try again."`
- ok  no call service started
- ok  the app is still open - `{"pidBefore":"5015","pidAfter":"7150"}`

<details><summary>Steps</summary>

- 252.1s tap Call - `"pressed Call"`
- 254.9s tap Don't allow

</details>

```
{
  "pageErrors": []
}
```

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
