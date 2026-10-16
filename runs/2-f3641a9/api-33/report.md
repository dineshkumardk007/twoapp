# Calls on Android 13 (API 33)

WebView: com.google.android.webview, 109.0.5414.123

## FAIL - First call while Priya is offline, allowing the microphone

Stopped: `timed out after 20s waiting for Android's microphone question`

- ok  the app is still open - `{"pidBefore":"","pidAfter":"3439"}`

<details><summary>Steps</summary>

- 33.0s tap Call - `"pressed Call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [first-call-while-priya-is-offline-allowing-the-mic.log](first-call-while-priya-is-offline-allowing-the-mic.log)

## FAIL - Call while Priya is offline rings out

- NO  the call service runs in the foreground
- NO  after 45 seconds it says No answer - `"END-TO-END ENCRYPTED Y P Partner Not online right now They will see that you called Cancel"`
- ok  the call service has stopped
- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

<details><summary>Steps</summary>

- 57.7s tap Call - `"pressed Call"`

</details>

```
{
  "pageErrors": []
}
```

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## FAIL - Call cancelled straight away, ten times

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [call-cancelled-straight-away-ten-times.log](call-cancelled-straight-away-ten-times.log)

## FAIL - Call that Priya answers, with the speaker on and off

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## FAIL - Priya calls and you answer

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [priya-calls-and-you-answer.log](priya-calls-and-you-answer.log)

## FAIL - Screen turned off in the middle of a call

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## FAIL - Choosing a photo opens the picker

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## FAIL - Taking a photo opens the camera

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [taking-a-photo-opens-the-camera.log](taking-a-photo-opens-the-camera.log)

## FAIL - Call when you don't allow the microphone

Stopped: `timed out after 15s waiting for the last call screen to close`

- ok  the app is still open - `{"pidBefore":"3439","pidAfter":"3439"}`

```
{
  "pageErrors": []
}
```

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
