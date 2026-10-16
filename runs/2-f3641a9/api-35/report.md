# Calls on Android 15 (API 35)

WebView: com.google.android.webview, 124.0.6367.219

## FAIL - First call while Priya is offline, allowing the microphone

Stopped: `page: DOMException: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
    at <anonymous>:3:7
    at <anonymous>:5:19`

- ok  the app is still open - `{"pidBefore":"","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![01-stopped.png](01-stopped.png)

Log: [first-call-while-priya-is-offline-allowing-the-mic.log](first-call-while-priya-is-offline-allowing-the-mic.log)

## FAIL - Call while Priya is offline rings out

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![02-stopped.png](02-stopped.png)

Log: [call-while-priya-is-offline-rings-out.log](call-while-priya-is-offline-rings-out.log)

## FAIL - Call cancelled straight away, ten times

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![03-stopped.png](03-stopped.png)

Log: [call-cancelled-straight-away-ten-times.log](call-cancelled-straight-away-ten-times.log)

## FAIL - Call that Priya answers, with the speaker on and off

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![04-stopped.png](04-stopped.png)

Log: [call-that-priya-answers-with-the-speaker-on-and-of.log](call-that-priya-answers-with-the-speaker-on-and-of.log)

## FAIL - Priya calls and you answer

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![05-stopped.png](05-stopped.png)

Log: [priya-calls-and-you-answer.log](priya-calls-and-you-answer.log)

## FAIL - Screen turned off in the middle of a call

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![06-stopped.png](06-stopped.png)

Log: [screen-turned-off-in-the-middle-of-a-call.log](screen-turned-off-in-the-middle-of-a-call.log)

## FAIL - Choosing a photo opens the picker

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![07-stopped.png](07-stopped.png)

Log: [choosing-a-photo-opens-the-picker.log](choosing-a-photo-opens-the-picker.log)

## FAIL - Taking a photo opens the camera

Stopped: `could not open Private Chat: no dock`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![08-stopped.png](08-stopped.png)

Log: [taking-a-photo-opens-the-camera.log](taking-a-photo-opens-the-camera.log)

## FAIL - Call when you don't allow the microphone

Stopped: `timed out after 90s waiting for the app to open`

- ok  the app is still open - `{"pidBefore":"2673","pidAfter":"2673"}`

```
{
  "pageErrors": []
}
```

![09-stopped.png](09-stopped.png)

Log: [call-when-you-don-t-allow-the-microphone.log](call-when-you-don-t-allow-the-microphone.log)
