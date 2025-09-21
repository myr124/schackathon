/* Socket.IO-based streaming STT server without express/dotenv.
   - Uses Node http + socket.io
   - Endpoint: http://localhost:5001 (Socket.IO default path /socket.io)
   - Protocol (events):
     Client -> Server:
       - "stt:start", { config?: { encoding, languageCode, enableAutomaticPunctuation } }
       - "stt:audio", ArrayBuffer | Buffer (binary audio chunk)
       - "stt:stop"
     Server -> Client:
       - "stt:ready"
       - "stt:started"
       - "stt:transcript", { text: string, isFinal: boolean }
       - "stt:stopped"
       - "stt:error", { message: string }
*/

const http = require("http");
const { Server } = require("socket.io");
const speech = require("@google-cloud/speech");

// Prefer JSON credentials via env for dev flexibility; otherwise fall back to ADC.
// Supported auth options:
// 1) GOOGLE_APPLICATION_CREDENTIALS_JSON = stringified JSON { client_email, private_key, project_id? }
// 2) GOOGLE_APPLICATION_CREDENTIALS = absolute path to service account JSON file (ADC)
// 3) gcloud auth application-default login (ADC)
function createSpeechClient() {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (json && json.trim() !== "") {
    try {
      const creds = JSON.parse(json);
      const { client_email, private_key, project_id } = creds || {};
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || project_id;
      if (client_email && private_key) {
        console.log(
          "Google STT auth: using GOOGLE_APPLICATION_CREDENTIALS_JSON"
        );
        return new speech.SpeechClient({
          projectId,
          credentials: { client_email, private_key },
        });
      } else {
        console.warn(
          "GOOGLE_APPLICATION_CREDENTIALS_JSON missing client_email/private_key; falling back to ADC."
        );
      }
    } catch (e) {
      console.warn(
        "Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON; falling back to ADC.",
        e?.message || e
      );
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("Google STT auth: using GOOGLE_APPLICATION_CREDENTIALS file");
  } else {
    console.log(
      "Google STT auth: using Application Default Credentials (gcloud auth application-default login)"
    );
  }
  return new speech.SpeechClient();
}

const PORT = process.env.STT_PORT || 5001;

// Minimal HTTP server just to attach Socket.IO and give a health check.
const httpServer = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket.IO STT server up");
});

// Socket.IO server
const io = new Server(httpServer, {
  // Adjust CORS as needed for your environment
  cors: { origin: "*" },
  // Default path is "/socket.io"
});

const speechClient = createSpeechClient();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  safeEmit(socket, "stt:ready");

  let recognizeStream = null;
  let streamingActive = false;
  let stoppedEmitted = false;
  let stopTimer = null;

  function startRecognition(userCfg) {
    stopRecognition();
    stoppedEmitted = false;
    if (stopTimer) {
      try {
        clearTimeout(stopTimer);
      } catch {}
      stopTimer = null;
    }

    const cfg = {
      // For MediaRecorder webm/opus in the browser, WEBM_OPUS is recommended
      encoding: "WEBM_OPUS",
      // Explicitly set Opus sample rate to avoid "sample rate (0)" errors
      sampleRateHertz: 48000,
      // Most browsers record mono mic streams by default; declare channels explicitly
      audioChannelCount: 1,
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      ...(userCfg || {}),
    };

    const request = {
      config: cfg,
      interimResults: true,
    };

    recognizeStream = speechClient
      .streamingRecognize(request)
      .on("error", (err) => {
        console.error("STT error:", err);
        safeEmit(socket, "stt:error", { message: err?.message || String(err) });
        stopRecognition();
      })
      .on("data", (data) => {
        try {
          const results = data.results || [];
          const first = results[0];
          const alternatives = first?.alternatives || [];
          const transcript = alternatives[0]?.transcript || "";
          const isFinal = Boolean(first?.isFinal);
          if (transcript) {
            console.log("stt:transcript", { text: transcript, isFinal });
            safeEmit(socket, "stt:transcript", { text: transcript, isFinal });
          }
        } catch (e) {
          console.error("Process data error:", e);
          safeEmit(socket, "stt:error", {
            message: "Process data error: " + (e?.message || String(e)),
          });
        }
      })
      .on("end", () => {
        if (!stoppedEmitted) {
          stoppedEmitted = true;
          streamingActive = false;
          safeEmit(socket, "stt:stopped");
        }
      })
      .on("close", () => {
        if (!stoppedEmitted) {
          stoppedEmitted = true;
          streamingActive = false;
          safeEmit(socket, "stt:stopped");
        }
      });

    streamingActive = true;
    safeEmit(socket, "stt:started");
  }

  function stopRecognition() {
    if (recognizeStream) {
      try {
        recognizeStream.end();
      } catch {}
      try {
        if (stopTimer) clearTimeout(stopTimer);
      } catch {}
      stopTimer = setTimeout(() => {
        if (!stoppedEmitted) {
          stoppedEmitted = true;
          streamingActive = false;
          safeEmit(socket, "stt:stopped");
        }
      }, 1000);
      recognizeStream = null;
    } else {
      if (!stoppedEmitted) {
        stoppedEmitted = true;
        streamingActive = false;
        safeEmit(socket, "stt:stopped");
      }
    }
  }

  socket.on("stt:start", (payload) => {
    try {
      const userCfg = payload?.config || {};
      startRecognition(userCfg);
    } catch (e) {
      console.error("stt:start error:", e);
      safeEmit(socket, "stt:error", { message: e?.message || String(e) });
    }
  });

  socket.on("stt:audio", (chunk) => {
    try {
      if (!streamingActive || !recognizeStream) {
        safeEmit(socket, "stt:error", {
          message:
            "Streaming not started. Emit 'stt:start' before sending audio.",
        });
        return;
      }
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); // handles ArrayBuffer/Uint8Array
      // Basic telemetry for troubleshooting
      if (buf.length > 0) {
        // eslint-disable-next-line no-console
        console.log("stt:audio bytes:", buf.length);
      }
      // Write raw audio buffer; the client library will wrap it as {audioContent: ...}
      recognizeStream.write(buf);
    } catch (e) {
      console.error("stt:audio error:", e);
      safeEmit(socket, "stt:error", { message: e?.message || String(e) });
    }
  });

  socket.on("stt:stop", () => {
    stopRecognition();
  });

  socket.on("disconnect", () => {
    stopRecognition();
    console.log("Socket disconnected:", socket.id);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
    safeEmit(socket, "stt:error", { message: err?.message || String(err) });
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO STT server listening on ${PORT}`);
});

function safeEmit(socket, event, payload) {
  try {
    socket.emit(event, payload);
  } catch (e) {
    console.error("safeEmit error:", e);
  }
}
