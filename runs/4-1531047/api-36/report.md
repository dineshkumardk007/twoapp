# Calls on Android 16 (API 36)

WebView: com.google.android.webview, 133.0.6943.137

## PASS - First call while Priya is offline, allowing the microphone

- ok  the call screen says Priya is not online - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service runs in the foreground - `{"running":true,"foreground":true}`
- ok  the "Call in progress" notification is up
- ok  the call service has stopped
- ok  the notification has gone
- ok  the app is still open - `{"pidBefore":"","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 60.3s tap Call - `"pressed Call"`
- 65.5s tap "While using the app"
- 69.9s tap Cancel - `"pressed Cancel call"`

</details>

```
{
  "pageErrors": []
}
```

![01-chat.png](01-chat.png) ![02-microphone-question.png](02-microphone-question.png) ![03-calling-offline.png](03-calling-offline.png) ![04-cancelled.png](04-cancelled.png)

Log: [first-call-while-priya-is-offline-allowing-the-mic.log](first-call-while-priya-is-offline-allowing-the-mic.log)

## PASS - Call while Priya is offline rings out

- ok  the call service runs in the foreground
- ok  after 45 seconds it says No answer - `"END-TO-END ENCRYPTED Y P Partner No answer They will see that you called."`
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 76.5s tap Call - `"pressed Call"`

</details>

```
{
  "pageErrors": []
}
```

![05-ringing-out.png](05-ringing-out.png) ![06-no-answer.png](06-no-answer.png)

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## PASS - Call cancelled straight away, ten times

- ok  no call service left running
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 129.7s Call, then Cancel after 0 ms
- 133.3s Call, then Cancel after 20 ms - `true`
- 137.1s Call, then Cancel after 40 ms - `true`
- 140.7s Call, then Cancel after 60 ms - `true`
- 144.4s Call, then Cancel after 90 ms - `true`
- 148.2s Call, then Cancel after 120 ms - `true`
- 151.9s Call, then Cancel after 180 ms - `true`
- 155.8s Call, then Cancel after 250 ms - `true`
- 159.7s Call, then Cancel after 400 ms - `true`
- 163.9s Call, then Cancel after 700 ms - `true`

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
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 187.2s tap Call - `"pressed Call"`
- 187.7s Priya sees - `"END-TO-END ENCRYPTED P D Dinesh online is calling you Decline Accept"`
- 188.0s Priya taps Accept - `"pressed Accept"`
- 190.4s tap Speaker - `"pressed Use speaker"`
- 192.3s tap Speaker again - `"pressed Use earpiece"`
- 195.4s tap End - `"pressed End call"`
- 198.4s Priya sees - `""`

</details>

```
{
  "audioAtEar": [
    "10-16 12:42:38:018 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:38:018 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:41:840 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:41:840 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:45:780 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:45:780 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:43:09:750 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:43:09:750 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10216/3987"
  ],
  "proximityAtEar": true,
  "audioOnSpeaker": [
    "10-16 12:42:41:840 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:41:840 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:45:780 setCommunicationRouteForClient for uid: 10216 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10216/3987",
    "10-16 12:42:45:780 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:ou
```

![07-in-call.png](07-in-call.png) ![08-speaker.png](08-speaker.png) ![09-ended.png](09-ended.png)

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## PASS - Priya calls and you answer

- ok  your phone rings - `"END-TO-END ENCRYPTED Y P Priya online is calling you Decline Accept"`
- ok  the call service runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 205.0s Priya taps Call - `"pressed Call"`
- 205.7s tap Accept - `"pressed Accept"`
- 210.6s Priya taps End - `"pressed End call"`
- 213.6s you see - `""`

</details>

```
{
  "pageErrors": []
}
```

![10-ringing-in.png](10-ringing-in.png) ![11-answered.png](11-answered.png)

Log: [priya-calls-and-you-answer.log](priya-calls-and-you-answer.log)

## PASS - Screen turned off in the middle of a call

- ok  the app is still running with the screen off
- ok  the call is still on (Priya sees a timer)
- ok  the call service still runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 218.5s tap Call - `"pressed Call"`
- 219.6s press the power button
- 232.3s tap End - `"pressed End call"`

</details>

```
{
  "pageErrors": []
}
```

![12-back-on.png](12-back-on.png)

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## PASS - Choosing a photo opens the picker

- ok  Android's picker is open - `"topResumedActivity=ActivityRecord{38976261 u0 com.google.android.photopicker/com.android.photopicker.PhotopickerGetContentActivity t8}"`
- ok  back in the chat
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 238.6s tap Send a photo - `"pressed Send a photo"`

</details>

```
{
  "pageErrors": []
}
```

![13-picker.png](13-picker.png)

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## PASS - Taking a photo opens the camera

- ok  back in the chat - `"topResumedActivity=ActivityRecord{92858593 u0 app.two.android/.MainActivity t8}"`
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 248.7s tap Take a photo - `"pressed Take a photo"`
- 253.7s on screen - `"topResumedActivity=ActivityRecord{178666841 u0 com.android.camera2/com.android.camera.CaptureActivity t8}"`

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
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"3987"}`

<details><summary>Steps</summary>

- 259.8s crash the page process
- 269.8s open Settings - `"ok"`

</details>

```
{
  "pageErrors": []
}
```

![15-page-restarted.png](15-page-restarted.png) ![16-settings-note.png](16-settings-note.png)

Log: [the-page-s-own-process-crashing-leaves-the-app-ope.log](the-page-s-own-process-crashing-leaves-the-app-ope.log)

## PASS - Call when you don't allow the microphone

- ok  the call screen says the microphone is not allowed - `"END-TO-END ENCRYPTED Y P Priya Microphone not allowed Allow microphone access for Two in your phone settings, then try again."`
- ok  no call service started
- ok  the app is still open - `{"pidBefore":"3987","pidAfter":"5873"}`

<details><summary>Steps</summary>

- 292.3s tap Call - `"pressed Call"`
- 295.9s tap Don't allow

</details>

```
{
  "pageErrors": []
}
```

![17-microphone-question.png](17-microphone-question.png) ![18-mic-refused.png](18-mic-refused.png)

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
