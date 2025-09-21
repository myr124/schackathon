import React, { useEffect, useRef, useState } from "react";

export default function VoiceWaveformPlayer({ audioUrl, question }) {
  const waveformRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wavesurfer, setWavesurfer] = useState(null);

  useEffect(() => {
    let ws;
    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#4F4A85",
        progressColor: "#383351",
        url: audioUrl,
        height: 80,
        barWidth: 3,
        responsive: true,
      });
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      setWavesurfer(ws);
    })();
    return () => {
      if (ws) ws.destroy();
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (wavesurfer) {
      if (isPlaying) {
        wavesurfer.pause();
      } else {
        wavesurfer.play();
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-xl shadow">
      <div className="mb-2 text-base font-medium">{question}</div>
      <div ref={waveformRef} className="mb-4" />
      <button
        onClick={handlePlayPause}
        className="bg-purple-700 hover:bg-purple-800 text-white rounded-full w-12 h-12 flex items-center justify-center focus:outline-none"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1" fill="white"/><rect x="14" y="5" width="4" height="14" rx="1" fill="white"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" fill="white"/></svg>
        )}
      </button>
    </div>
  );
}
