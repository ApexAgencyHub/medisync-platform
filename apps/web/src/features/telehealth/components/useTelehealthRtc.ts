"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppointmentSummary,
  AuthResponse,
  TelehealthIceServer,
  TelehealthParticipantPresence,
  TelehealthParticipantRole,
  TelehealthSignalEnvelope,
  TelehealthSignalKind,
  TelehealthSignalPayload,
} from "@medisync/contracts";
import {
  fetchTelehealthRoomState,
  postTelehealthPresence,
  postTelehealthSignal,
  subscribeTelehealthStream,
} from "../api-client";

export type TelehealthRoomPhase =
  | { status: "loading" }
  | { status: "error"; httpStatus: number | null; code: string }
  | {
      status: "ready";
      appointment: AppointmentSummary;
      selfRole: TelehealthParticipantRole;
      iceServers: TelehealthIceServer[];
    }
  | { status: "left"; appointment: AppointmentSummary; selfRole: TelehealthParticipantRole };

export type RtcLinkStatus =
  | "idle"
  | "connecting"
  | "waiting-peer"
  | "connected"
  | "reconnecting";

export interface UseTelehealthRtcResult {
  phase: TelehealthRoomPhase;
  participants: readonly TelehealthParticipantPresence[];
  peerPresence: TelehealthParticipantPresence | null;
  rtcStatus: RtcLinkStatus;
  turnRelayConfigured: boolean;
  mediaWarning: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micEnabled: boolean;
  camEnabled: boolean;
  clinicalPulseCount: number;
  callSeconds: number;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  notifyClinicalUpdate: (
    clinicalEvent: "visit-note" | "prescription",
  ) => Promise<void>;
  leaveCall: () => Promise<void>;
  reconnectCall: () => void;
  rejoinCall: () => void;
}

export function useTelehealthRtc(options: {
  appointmentId: string;
  apiBaseUrl: string;
  session: AuthResponse | null;
  sessionHydrated: boolean;
}): UseTelehealthRtcResult {
  const { appointmentId, apiBaseUrl, session, sessionHydrated } = options;

  const [phase, setPhase] = useState<TelehealthRoomPhase>({ status: "loading" });
  const [participants, setParticipants] = useState<TelehealthParticipantPresence[]>([]);
  const [rtcStatus, setRtcStatus] = useState<RtcLinkStatus>("idle");
  const [mediaWarning, setMediaWarning] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [clinicalPulseCount, setClinicalPulseCount] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const lastSeqRef = useRef<number>(0);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);
  const appointmentRef = useRef<AppointmentSummary | null>(null);
  const selfRoleRef = useRef<TelehealthParticipantRole | null>(null);
  const hasJoinedRoomRef = useRef<boolean>(false);

  const peerPresence =
    selfRoleRef.current === null
      ? null
      : (participants.find(
          (p) => p.role !== selfRoleRef.current && p.joined,
        ) ?? null);

  useEffect(() => {
    if (rtcStatus !== "connected") return;
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rtcStatus]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!session) {
      setPhase({ status: "error", httpStatus: 401, code: "UNAUTHORIZED" });
      return;
    }

    const token = session.token;
    const userId = session.user.id;
    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    let mounted = true;
    let streamReconnectTimer: number | null = null;
    lastSeqRef.current = 0;
    pendingIceRef.current = [];

    const teardownRtc = () => {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onnegotiationneeded = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }
      if (mounted) {
        setLocalStream(null);
        setRemoteStream(null);
      }
    };

    const upsertParticipant = (next: TelehealthParticipantPresence) => {
      setParticipants((prev) => {
        const filtered = prev.filter((item) => item.role !== next.role);
        return [...filtered, next].sort((a, b) => a.role.localeCompare(b.role));
      });
    };

    const dispatchOffer = async (pc: RTCPeerConnection, iceRestart = false) => {
      if (makingOfferRef.current) return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer(
          iceRestart ? { iceRestart: true } : undefined,
        );
        if (!mounted || pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        if (pc.localDescription?.sdp) {
          await postTelehealthSignal(apiBaseUrl, token, appointmentId, {
            kind: "offer",
            payload: {
              sdpType: "offer",
              sdp: pc.localDescription.sdp,
            },
          });
        }
      } catch {
        // Handled cleanly if peer or connection closes mid-negotiation
      } finally {
        makingOfferRef.current = false;
      }
    };

    const handleSignalEnvelope = async (
      envelope: TelehealthSignalEnvelope,
      selfRole: TelehealthParticipantRole,
      pc: RTCPeerConnection,
    ) => {
      if (envelope.seq <= lastSeqRef.current) return;
      lastSeqRef.current = envelope.seq;

      if (envelope.kind === "clinical-updated") {
        if (mounted) setClinicalPulseCount((c) => c + 1);
        return;
      }
      if (envelope.senderUserId === userId) return;

      const polite = selfRole === "PATIENT";

      if (envelope.kind === "hangup") {
        if (mounted) {
          setRemoteStream(null);
          setRtcStatus("waiting-peer");
        }
        return;
      }

      if (envelope.kind === "ready") {
        if (!polite) {
          await dispatchOffer(pc, Boolean(pc.remoteDescription));
        }
        return;
      }

      if (envelope.kind === "offer" && envelope.payload.sdp) {
        const offerCollision =
          makingOfferRef.current || pc.signalingState !== "stable";
        ignoreOfferRef.current = !polite && offerCollision;
        if (ignoreOfferRef.current) return;

        try {
          if (mounted) setRtcStatus("connecting");
          if (offerCollision && polite && pc.signalingState !== "stable") {
            await pc.setLocalDescription({ type: "rollback" }).catch(() => undefined);
          }
          await pc.setRemoteDescription({
            type: "offer",
            sdp: envelope.payload.sdp,
          });
          while (pendingIceRef.current.length > 0) {
            const candidate = pendingIceRef.current.shift();
            if (candidate) {
              await pc.addIceCandidate(candidate).catch(() => undefined);
            }
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (pc.localDescription?.sdp) {
            await postTelehealthSignal(apiBaseUrl, token, appointmentId, {
              kind: "answer",
              payload: {
                sdpType: "answer",
                sdp: pc.localDescription.sdp,
              },
            });
          }
        } catch {
          // Safe guard against transient teardown races
        }
        return;
      }

      if (envelope.kind === "answer" && envelope.payload.sdp) {
        try {
          await pc.setRemoteDescription({
            type: "answer",
            sdp: envelope.payload.sdp,
          });
          while (pendingIceRef.current.length > 0) {
            const candidate = pendingIceRef.current.shift();
            if (candidate) {
              await pc.addIceCandidate(candidate).catch(() => undefined);
            }
          }
        } catch {
          // Ignore stale/duplicate answer cleanly
        }
        return;
      }

      if (envelope.kind === "ice" && envelope.payload.candidate) {
        const candidateInit: RTCIceCandidateInit = {
          candidate: envelope.payload.candidate,
          sdpMid: envelope.payload.sdpMid ?? null,
          sdpMLineIndex: envelope.payload.sdpMLineIndex ?? null,
        };
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidateInit).catch(() => undefined);
        } else {
          if (pendingIceRef.current.length < 48) {
            pendingIceRef.current.push(candidateInit);
          }
        }
      }
    };

    const bootRoom = async () => {
      setPhase({ status: "loading" });
      setRtcStatus("connecting");
      const roomRes = await fetchTelehealthRoomState(
        apiBaseUrl,
        token,
        appointmentId,
      );
      if (!mounted || abortController.signal.aborted) return;

      if (!roomRes.ok) {
        setPhase({
          status: "error",
          httpStatus: roomRes.status,
          code: roomRes.error,
        });
        setRtcStatus("idle");
        return;
      }

      const { appointment, selfRole, participants: initialParticipants, recentSignals, iceServers } =
        roomRes.data;
      appointmentRef.current = appointment;
      selfRoleRef.current = selfRole;
      setParticipants(initialParticipants);
      setPhase({ status: "ready", appointment, selfRole, iceServers });

      // Acquire local camera/mic smoothly with graceful Clinical Sync fallback when headless
      let acquiredStream: MediaStream | null = null;
      let hasMic = false;
      let hasCam = false;
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch {
          try {
            acquiredStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: { echoCancellation: true, noiseSuppression: true },
            });
          } catch {
            acquiredStream = null;
          }
        }
      }

      if (!mounted || abortController.signal.aborted) {
        if (acquiredStream) {
          for (const t of acquiredStream.getTracks()) t.stop();
        }
        return;
      }

      if (acquiredStream) {
        hasMic = acquiredStream.getAudioTracks().length > 0;
        hasCam = acquiredStream.getVideoTracks().length > 0;
        localStreamRef.current = acquiredStream;
        setLocalStream(acquiredStream);
        setMicEnabled(hasMic);
        setCamEnabled(hasCam);
        setMediaWarning(!hasCam);
      } else {
        setMicEnabled(false);
        setCamEnabled(false);
        setMediaWarning(true);
      }

      const rtcIceServers: RTCIceServer[] = iceServers.map((srv) => ({
        urls: srv.urls,
        ...(srv.username !== undefined ? { username: srv.username } : {}),
        ...(srv.credential !== undefined ? { credential: srv.credential } : {}),
      }));
      const pc = new RTCPeerConnection({
        iceServers: rtcIceServers,
        iceCandidatePoolSize: 2,
      });
      pcRef.current = pc;

      if (acquiredStream) {
        for (const track of acquiredStream.getTracks()) {
          pc.addTrack(track, acquiredStream);
        }
      } else {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      const outboundRemote = new MediaStream();
      pc.ontrack = (event) => {
        const inbound = event.streams[0];
        if (inbound) {
          setRemoteStream(inbound);
        } else {
          outboundRemote.addTrack(event.track);
          setRemoteStream(new MediaStream(outboundRemote.getTracks()));
        }
        if (mounted) setRtcStatus("connected");
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || abortController.signal.aborted) return;
        const payload: TelehealthSignalPayload = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        void postTelehealthSignal(apiBaseUrl, token, appointmentId, {
          kind: "ice",
          payload,
        });
      };

      const MAX_AUTO_ICE_RESTARTS = 3;
      const ICE_RESTART_COOLDOWN_MS = 4_000;
      let autoIceRestartAttempts = 0;
      let lastIceRestartAtMs = 0;

      const triggerBoundedIceRestart = () => {
        if (selfRole !== "DOCTOR") return;
        const nowMs = Date.now();
        if (
          autoIceRestartAttempts >= MAX_AUTO_ICE_RESTARTS ||
          nowMs - lastIceRestartAtMs < ICE_RESTART_COOLDOWN_MS
        ) {
          return;
        }
        autoIceRestartAttempts += 1;
        lastIceRestartAtMs = nowMs;
        void dispatchOffer(pc, true);
      };

      pc.onconnectionstatechange = () => {
        if (!mounted) return;
        if (pc.connectionState === "connected") {
          autoIceRestartAttempts = 0;
          setRtcStatus("connected");
        } else if (pc.connectionState === "connecting") {
          setRtcStatus("connecting");
        } else if (pc.connectionState === "disconnected") {
          setRtcStatus("reconnecting");
        } else if (pc.connectionState === "failed") {
          setRtcStatus("reconnecting");
          triggerBoundedIceRestart();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!mounted) return;
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          autoIceRestartAttempts = 0;
          setRtcStatus("connected");
        } else if (pc.iceConnectionState === "disconnected") {
          setRtcStatus("reconnecting");
        } else if (pc.iceConnectionState === "failed") {
          setRtcStatus("reconnecting");
          triggerBoundedIceRestart();
        }
      };

      pc.onnegotiationneeded = () => {
        if (selfRole === "DOCTOR") {
          void dispatchOffer(pc);
        }
      };

      const peerAlreadyJoined = initialParticipants.some(
        (p) => p.role !== selfRole && p.joined,
      );
      setRtcStatus(peerAlreadyJoined ? "connecting" : "waiting-peer");

      for (const sig of recentSignals) {
        await handleSignalEnvelope(sig, selfRole, pc);
      }

      await postTelehealthPresence(apiBaseUrl, token, appointmentId, {
        joined: true,
        audioEnabled: hasMic,
        videoEnabled: hasCam,
      });
      hasJoinedRoomRef.current = true;
      await postTelehealthSignal(apiBaseUrl, token, appointmentId, {
        kind: "ready",
        payload: { audioEnabled: hasMic, videoEnabled: hasCam },
      });

      if (selfRole === "DOCTOR" && peerAlreadyJoined) {
        await dispatchOffer(pc);
      }

      let retryAttempt = 0;
      const runStreamLoop = async () => {
        while (mounted && !abortController.signal.aborted) {
          try {
            await subscribeTelehealthStream(
              apiBaseUrl,
              token,
              appointmentId,
              lastSeqRef.current,
              abortController.signal,
              {
                onOpen: () => {
                  retryAttempt = 0;
                },
                onEvent: (event) => {
                  if (!mounted) return;
                  if (event.type === "snapshot") {
                    setParticipants(event.participants);
                    for (const sig of event.recentSignals) {
                      void handleSignalEnvelope(sig, selfRole, pc);
                    }
                  } else if (event.type === "presence") {
                    upsertParticipant(event.participant);
                    if (
                      event.participant.role !== selfRole &&
                      event.participant.joined &&
                      selfRole === "DOCTOR" &&
                      pc.signalingState === "stable"
                    ) {
                      void dispatchOffer(pc, Boolean(pc.remoteDescription));
                    } else if (
                      event.participant.role !== selfRole &&
                      !event.participant.joined
                    ) {
                      setRemoteStream(null);
                      setRtcStatus("waiting-peer");
                    }
                  } else if (event.type === "signal") {
                    void handleSignalEnvelope(event.signal, selfRole, pc);
                  }
                },
              },
            );
          } catch {
            // Reconnect gracefully after transient stream or proxy drop
          }
          if (!mounted || abortController.signal.aborted) break;
          retryAttempt += 1;
          const waitMs = Math.min(8_000, 1_000 * 2 ** Math.min(retryAttempt, 3));
          await new Promise<void>((resolve) => {
            streamReconnectTimer = window.setTimeout(resolve, waitMs);
          });
        }
      };

      void runStreamLoop();
    };

    void bootRoom();

    const handlePageHide = () => {
      if (!hasJoinedRoomRef.current) return;
      hasJoinedRoomRef.current = false;
      void postTelehealthPresence(
        apiBaseUrl,
        token,
        appointmentId,
        { joined: false, audioEnabled: false, videoEnabled: false },
        true,
      );
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mounted = false;
      abortController.abort();
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null;
      }
      if (streamReconnectTimer !== null) {
        window.clearTimeout(streamReconnectTimer);
      }
      window.removeEventListener("pagehide", handlePageHide);
      handlePageHide();
      teardownRtc();
    };
    // Bound strictly to session token & user id to avoid tearing down active calls on profile edits
  }, [appointmentId, apiBaseUrl, session?.token, session?.user.id, sessionHydrated, connectionEpoch]);

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current;
    const nextEnabled = !micEnabled;
    if (stream) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = nextEnabled;
      }
    }
    setMicEnabled(nextEnabled);
    if (session) {
      await postTelehealthPresence(apiBaseUrl, session.token, appointmentId, {
        joined: true,
        audioEnabled: nextEnabled,
        videoEnabled: camEnabled,
      });
    }
  }, [micEnabled, camEnabled, session, apiBaseUrl, appointmentId]);

  const toggleCam = useCallback(async () => {
    const stream = localStreamRef.current;
    const nextEnabled = !camEnabled;
    if (stream) {
      for (const track of stream.getVideoTracks()) {
        track.enabled = nextEnabled;
      }
    }
    setCamEnabled(nextEnabled);
    if (session) {
      await postTelehealthPresence(apiBaseUrl, session.token, appointmentId, {
        joined: true,
        audioEnabled: micEnabled,
        videoEnabled: nextEnabled,
      });
    }
  }, [camEnabled, micEnabled, session, apiBaseUrl, appointmentId]);

  const notifyClinicalUpdate = useCallback(
    async (clinicalEvent: "visit-note" | "prescription") => {
      if (!session) return;
      const kind: TelehealthSignalKind = "clinical-updated";
      await postTelehealthSignal(apiBaseUrl, session.token, appointmentId, {
        kind,
        payload: { clinicalEvent },
      });
    },
    [session, apiBaseUrl, appointmentId],
  );

  const leaveCall = useCallback(async () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;

    // Release camera, microphone, and RTCPeerConnection immediately before any network calls
    hasJoinedRoomRef.current = false;
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setRtcStatus("idle");
    if (appointmentRef.current && selfRoleRef.current) {
      setPhase({
        status: "left",
        appointment: appointmentRef.current,
        selfRole: selfRoleRef.current,
      });
    }

    if (session) {
      await Promise.allSettled([
        postTelehealthSignal(apiBaseUrl, session.token, appointmentId, {
          kind: "hangup",
          payload: {},
        }),
        postTelehealthPresence(apiBaseUrl, session.token, appointmentId, {
          joined: false,
          audioEnabled: false,
          videoEnabled: false,
        }),
      ]);
    }
  }, [session, apiBaseUrl, appointmentId]);

  const reconnectCall = useCallback(() => {
    setConnectionEpoch((n) => n + 1);
  }, []);

  const rejoinCall = useCallback(() => {
    setCallSeconds(0);
    setConnectionEpoch((n) => n + 1);
  }, []);

  const turnRelayConfigured =
    phase.status === "ready" &&
    phase.iceServers.some((srv) => {
      const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
      const hasTurnScheme = urls.some((u) => /^turns?:/i.test(u.trim()));
      return (
        hasTurnScheme &&
        typeof srv.username === "string" &&
        srv.username.trim().length > 0 &&
        typeof srv.credential === "string" &&
        srv.credential.trim().length > 0
      );
    });

  return {
    phase,
    participants,
    peerPresence,
    rtcStatus,
    turnRelayConfigured,
    mediaWarning,
    localStream,
    remoteStream,
    micEnabled,
    camEnabled,
    clinicalPulseCount,
    callSeconds,
    toggleMic,
    toggleCam,
    notifyClinicalUpdate,
    leaveCall,
    reconnectCall,
    rejoinCall,
  };
}
