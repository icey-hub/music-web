"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerStatus, Track } from "@/types/music";

type UseAudioPlayerResult = {
  currentTrack: Track;
  currentIndex: number;
  playingTrackId: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  status: PlayerStatus;
  selectTrack: (trackId: string) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (value: number) => void;
  setVolume: (value: number) => void;
};

function fallbackDuration(index: number) {
  return 168 + (index % 6) * 19;
}

const metingMirrors = ["https://api.injahow.cn/meting/", "https://api.qijieya.cn/meting/"];

function normalizeMetingBase(value: string) {
  return value.replace(/\/+$/, "");
}

function getAudioAlternates(source: string) {
  const queryStart = source.indexOf("?");
  if (queryStart === -1) {
    return [];
  }

  const currentBase = normalizeMetingBase(source.slice(0, queryStart));
  const query = source.slice(queryStart);

  return metingMirrors
    .filter((mirror) => normalizeMetingBase(mirror) !== currentBase)
    .map((mirror) => `${normalizeMetingBase(mirror)}/${query}`);
}

export function useAudioPlayer(tracks: Track[]): UseAudioPlayerResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(() => fallbackDuration(0));
  const [volume, setVolumeState] = useState(0.72);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [fallbackMode, setFallbackMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);
  const sourceUrlRef = useRef(tracks[0]?.audio ?? "");
  const currentIndexRef = useRef(currentIndex);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const sourceSeqRef = useRef(0);
  const alternateRef = useRef<{ seq: number; urls: string[]; next: number } | null>(null);
  const failedSeqRef = useRef<Set<number>>(new Set());
  const playIndexRef = useRef<(index: number, shouldPlay: boolean) => void>(() => {});

  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const next = useCallback(() => {
    const nextIndex = (currentIndexRef.current + 1) % tracks.length;
    playIndexRef.current(nextIndex, isPlayingRef.current || pendingPlayRef.current);
  }, [tracks.length]);

  const previous = useCallback(() => {
    const nextIndex = (currentIndexRef.current - 1 + tracks.length) % tracks.length;
    playIndexRef.current(nextIndex, isPlayingRef.current || pendingPlayRef.current);
  }, [tracks.length]);

  const startFallback = useCallback(() => {
    pendingPlayRef.current = false;
    isPlayingRef.current = false;
    setFallbackMode(true);
    setDuration((value) => value || fallbackDuration(currentIndexRef.current));
    setPlayingTrackId(null);
    setIsPlaying(false);
    setStatus("fallback");
  }, []);

  const playAudio = useCallback(
    (audio: HTMLAudioElement) => {
      const track = tracks[currentIndexRef.current];
      isPlayingRef.current = true;
      setPlayingTrackId(track?.id ?? null);
      setIsPlaying(true);
      setStatus("loading");

      audio
        .play()
        .then(() => {
          pendingPlayRef.current = false;
          setFallbackMode(false);
          setStatus("playing");
        })
        .catch(() => {
          const seq = sourceSeqRef.current;
          if (!alternateRef.current || alternateRef.current.seq !== seq) {
            alternateRef.current = {
              seq,
              urls: getAudioAlternates(sourceUrlRef.current || audio.src),
              next: 0
            };
          }

          const alternate = alternateRef.current;
          if (alternate.next < alternate.urls.length) {
            const nextUrl = alternate.urls[alternate.next];
            alternate.next += 1;
            sourceUrlRef.current = nextUrl;
            audio.src = nextUrl;
            setStatus("loading");
            audio.play().catch(() => {
              startFallback();
            });
            return;
          }

          failedSeqRef.current.add(seq);
          startFallback();
        });
    },
    [startFallback, tracks]
  );

  const playIndex = useCallback(
    (index: number, shouldPlay: boolean) => {
      const track = tracks[index];
      if (!track) {
        return;
      }

      const audio = audioRef.current;
      currentIndexRef.current = index;
      pendingPlayRef.current = shouldPlay;
      sourceSeqRef.current += 1;
      alternateRef.current = null;
      sourceUrlRef.current = track.audio;

      setCurrentIndex(index);
      setProgress(0);
      setDuration(fallbackDuration(index));
      setFallbackMode(false);
      setStatus(shouldPlay ? "loading" : "idle");
      isPlayingRef.current = shouldPlay;
      setPlayingTrackId(shouldPlay ? track.id : null);
      setIsPlaying(shouldPlay);

      if (!audio) {
        return;
      }

      audio.pause();
      audio.src = track.audio;
      audio.currentTime = 0;
      audio.volume = volumeRef.current;
      audio.load();
      if (shouldPlay) {
        playAudio(audio);
        return;
      }

      pendingPlayRef.current = false;
      isPlayingRef.current = false;
      setIsPlaying(false);
    },
    [playAudio, tracks]
  );

  useEffect(() => {
    playIndexRef.current = playIndex;
  }, [playIndex]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volumeRef.current;
    audioRef.current = audio;

    const switchToAlternateOrFallback = () => {
      const seq = sourceSeqRef.current;
      if (!failedSeqRef.current.has(seq)) {
        if (!alternateRef.current || alternateRef.current.seq !== seq) {
          alternateRef.current = {
            seq,
            urls: getAudioAlternates(sourceUrlRef.current || audio.src),
            next: 0
          };
        }

        const alternate = alternateRef.current;
        if (alternate.next < alternate.urls.length) {
          const nextUrl = alternate.urls[alternate.next];
          alternate.next += 1;
          sourceUrlRef.current = nextUrl;
          audio.src = nextUrl;
          setStatus("loading");
          if (isPlayingRef.current || pendingPlayRef.current) {
            audio.play().catch(() => {
              startFallback();
            });
          } else {
            audio.load();
            setStatus("idle");
          }
          return;
        }

        failedSeqRef.current.add(seq);
      }
      startFallback();
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
    };
    const handleEnded = () => {
      playIndexRef.current((currentIndexRef.current + 1) % tracks.length, true);
    };
    const handlePlay = () => {
      const track = tracks[currentIndexRef.current];
      isPlayingRef.current = true;
      setPlayingTrackId(track?.id ?? null);
      setIsPlaying(true);
      setFallbackMode(false);
      setStatus("playing");
    };
    const handlePause = () => {
      if (!audio.ended && !isPlayingRef.current) {
        setPlayingTrackId(null);
        setStatus("paused");
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", switchToAlternateOrFallback);

    playIndexRef.current(currentIndexRef.current, false);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", switchToAlternateOrFallback);
      audio.pause();
      audioRef.current = null;
    };
  }, [startFallback, tracks]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;

    if (isPlaying) {
      pendingPlayRef.current = false;
      audio?.pause();
      isPlayingRef.current = false;
      setPlayingTrackId(null);
      setIsPlaying(false);
      setStatus("paused");
      return;
    }

    isPlayingRef.current = true;
    setPlayingTrackId(tracks[currentIndexRef.current]?.id ?? null);
    setIsPlaying(true);
    if (fallbackMode) {
      setFallbackMode(false);
      playIndexRef.current(currentIndexRef.current, true);
      return;
    }

    if (!audio) {
      isPlayingRef.current = false;
      setPlayingTrackId(null);
      setIsPlaying(false);
      setStatus("fallback");
      return;
    }

    if (!audio.src) {
      playIndexRef.current(currentIndexRef.current, true);
      return;
    }

    playAudio(audio);
  }, [fallbackMode, isPlaying, playAudio, tracks]);

  const selectTrack = useCallback(
    (trackId: string) => {
      const nextIndex = tracks.findIndex((track) => track.id === trackId);
      if (nextIndex === -1) {
        return;
      }
      playIndexRef.current(nextIndex, true);
    },
    [tracks]
  );

  const seek = useCallback(
    (value: number) => {
      const safeValue = Math.max(0, Math.min(value, duration || fallbackDuration(currentIndex)));
      const audio = audioRef.current;
      setProgress(safeValue);
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = safeValue;
      }
    },
    [currentIndex, duration]
  );

  const setVolume = useCallback((value: number) => {
    const nextVolume = Math.max(0, Math.min(value, 1));
    setVolumeState(nextVolume);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  }, []);

  return useMemo(
    () => ({
      currentTrack,
      currentIndex,
      playingTrackId,
      isPlaying,
      progress,
      duration,
      volume,
      status,
      selectTrack,
      togglePlay,
      next,
      previous,
      seek,
      setVolume
    }),
    [
      currentTrack,
      currentIndex,
      playingTrackId,
      isPlaying,
      progress,
      duration,
      volume,
      status,
      selectTrack,
      togglePlay,
      next,
      previous,
      seek,
      setVolume
    ]
  );
}
