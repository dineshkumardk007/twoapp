# Calls on Android 15 (API 35)

WebView: com.google.android.webview, 124.0.6367.219

## PASS - First call while Priya is offline, allowing the microphone

- ok  the call screen says Priya is not online - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service runs in the foreground - `{"running":true,"foreground":true}`
- ok  the "Call in progress" notification is up
- ok  the call service has stopped
- ok  the notification has gone
- ok  the app is still open - `{"pidBefore":"","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 56.6s tap Call - `"pressed Call"`
- 60.3s tap "While using the app"
- 64.7s tap Cancel - `"pressed Cancel call"`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 71.6s tap Call - `"pressed Call"`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 124.7s Call, then Cancel after 0 ms - `true`
- 128.3s Call, then Cancel after 20 ms - `true`
- 131.9s Call, then Cancel after 40 ms - `true`
- 135.5s Call, then Cancel after 60 ms - `true`
- 139.3s Call, then Cancel after 90 ms - `true`
- 143.0s Call, then Cancel after 120 ms - `true`
- 146.8s Call, then Cancel after 180 ms - `true`
- 150.6s Call, then Cancel after 250 ms - `true`
- 154.6s Call, then Cancel after 400 ms - `true`
- 158.8s Call, then Cancel after 700 ms - `true`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 177.6s tap Call - `"pressed Call"`
- 178.2s Priya sees - `"END-TO-END ENCRYPTED P D Dinesh online is calling you Decline Accept"`
- 178.2s Priya taps Accept - `"pressed Accept"`
- 180.1s tap Speaker - `"pressed Use speaker"`
- 182.2s tap Speaker again - `"pressed Use earpiece"`
- 185.4s tap End - `"pressed End call"`
- 188.4s Priya sees - `""`

</details>

```
{
  "audioAtEar": [
    "10-16 12:41:59:879 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:41:59:880 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:03:690 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:03:690 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:07:640 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:07:640 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:27:182 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:27:182 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10209/3791"
  ],
  "proximityAtEar": true,
  "audioOnSpeaker": [
    "10-16 12:42:03:690 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:03:690 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] eventSource: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:07:640 setCommunicationRouteForClient for uid: 10209 device: AudioDeviceAttributes: role:output type:speaker addr: name:sdk_gphone64_x86_64 profiles:[] descriptors:[] isPrivileged: false from API: setCommunicationDevice() from u/pid:10209/3791",
    "10-16 12:42:07:640 updateCommunicationRoute, preferredCommunicationDevice: AudioDeviceAttributes: role:ou
```

![07-in-call.png](07-in-call.png) ![08-speaker.png](08-speaker.png) ![09-ended.png](09-ended.png)

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## PASS - Priya calls and you answer

- ok  your phone rings - `"END-TO-END ENCRYPTED Y P Priya online is calling you Decline Accept"`
- ok  the call service runs in the foreground
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 195.0s Priya taps Call - `"pressed Call"`
- 195.7s tap Accept - `"pressed Accept"`
- 200.6s Priya taps End - `"pressed End call"`
- 203.6s you see - `""`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 208.4s tap Call - `"pressed Call"`
- 209.5s press the power button
- 222.1s tap End - `"pressed End call"`

</details>

```
{
  "pageErrors": []
}
```

![12-back-on.png](12-back-on.png)

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## PASS - Choosing a photo opens the picker

- ok  Android's picker is open - `"topResumedActivity=ActivityRecord{5d4efc5 u0 com.google.android.providers.media.module/com.android.providers.media.photopicker.PhotoPickerGetContentActivity t8}"`
- ok  back in the chat
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 228.4s tap Send a photo - `"pressed Send a photo"`

</details>

```
{
  "pageErrors": []
}
```

![13-picker.png](13-picker.png)

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## PASS - Taking a photo opens the camera

- ok  back in the chat - `"topResumedActivity=ActivityRecord{e0db11 u0 app.two.android/.MainActivity t8}"`
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 238.4s tap Take a photo - `"pressed Take a photo"`
- 243.5s on screen - `"topResumedActivity=ActivityRecord{3c7ecf4 u0 com.android.camera2/com.android.camera.CaptureActivity t8}"`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"3791"}`

<details><summary>Steps</summary>

- 249.5s crash the page process
- 258.7s open Settings - `"ok"`

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
- ok  the app is still open - `{"pidBefore":"3791","pidAfter":"5337"}`

<details><summary>Steps</summary>

- 278.2s tap Call - `"pressed Call"`
- 280.7s tap Don't allow

</details>

```
{
  "pageErrors": []
}
```

![17-microphone-question.png](17-microphone-question.png) ![18-mic-refused.png](18-mic-refused.png)

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
