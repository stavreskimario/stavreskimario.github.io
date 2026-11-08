# Local response capture and the isolated control

The first local browser run passed all 34 walking legs, seven mounted arrivals material and PBR checks, the applied Orbit and Walk poses, and 103 checks after closure covering 93 unique frozen files. Its strict network result remains **FAILED**: 25 local requests ended with Chrome `ERR_ABORTED`, and their response bodies were unavailable through CDP. The original report remains unchanged.

A short test of the final production bundle used a separate CDP session with 512 MiB of total buffering and 64 MiB per resource. It still recorded 26 cancelled local requests. Adding an accurate `Content-Length` header still recorded 29. Both short tests passed the material, control and 101 frozen-byte checks. Increasing the buffer and adding the header therefore did not resolve the observation failure.

In both short tests, every cancelled local request reported `Network.dataReceived.dataLength` equal to its complete frozen file size before cancellation. That establishes full byte counts; it does not establish browser-computed hashes for those individual application responses. The cancellations came from the pinned Three.js `FileLoader` fetch and stream path. The separate model, reflection and image loading paths completed.

An isolated fixture then served the same 3,029,067-byte AO texture to 24 parallel requests per condition. The production application and 3D renderer were absent. The browser computed SHA-256 after each operation resolved.

| Browser operation | Complete browser hashes matching the texture | Chrome finished / failed | Exact bodies available through CDP |
| --- | --- | --- | --- |
| Direct fetch to array buffer, routing enabled | 24 / 24 | 24 / 0 | 24 / 24 |
| Actual pinned FileLoader to array buffer, routing enabled | 24 / 24 | 0 / 24 | 0 / 24 |
| Actual pinned FileLoader to array buffer, routing disabled | 24 / 24 | 10 / 14 | 10 / 24 |

This reproduces complete, correctly hashed browser buffers alongside Chrome's cancellation report using the actual library. Request interception affects the observed rate but is not required for the effect. The internal Chromium lifetime or stream cause has not been established. No garbage collection or buffer eviction explanation is claimed, and no application or library workaround was applied.

The texture SHA-256 was `6973003abb78858f457c9d7a9a359e01504872389473e521b089d685b96271ba`. The fixture, library source and execution script stayed byte exact. Every diagnostic browser closed before the next browser check began.

The subsequent **actual public validation passed** at commit `50f193384bd6cfa0827cdc6a1cb7deba414fd62e`: all 19 selected, naturally loaded response bodies matched the frozen local bytes; all eight native walking legs, seven material and PBR checks, four 4K GI and 2K AO bindings, applied mode poses, six persistent zones and 22 checks after closure passed. One external font was deliberately blocked. There were no unexplained failures or body-read failures. The public browser closed at `2026-11-02T05:15:45.950Z`. That public result is the publication evidence; the earlier local failures remain retained separately.

Original report pins:

- Local native run: `native-wide-c2-v1/report.json`, SHA-256 `f50aebfb041b26222f6fbd84664a09e5b5b4ebeae8ecdb7a816d729930c4b043`.
- Buffered short test: `network-material-final-v1/report.json`, SHA-256 `446f93a76775505358f79952ed6eba97aa3396e906362c834f1b5f07da1586d0`.
- Buffered test with content length: `network-material-final-length-v1/report.json`, SHA-256 `dfb66ae17c3553a0aa1d30433b48631ba45e8f7da21ef61e3febd9aa8c651965`.
- Actual-library fixture: `isolated-fileloader-probe-v1/report.json`, SHA-256 `df7a353b4030fa2c979751a0c60204b4825ebe3e4a37358944f13180638f6546`.
- Public validation: `public-final-v1/report.json`, SHA-256 `5b9c0fb1e7aa84407d99777699a14250930f796ac1fa254ab727856b90f68ede`.

All original errors and timestamps are retained. The screenshots are actual browser captures. No image was generated or substituted.
