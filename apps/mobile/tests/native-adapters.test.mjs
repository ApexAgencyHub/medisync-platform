/* global Response */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchMobilePharmacyCatalog,
  resolveMobileApiBaseUrl,
  sendMobileTelemetryHeartbeat,
  transmitDriverGpsPing,
  uploadPickedBinaryMedia,
  verifyScannedQrPrescription,
} from "../src/services/native-adapters.ts";

describe("mobile native adapters", () => {
  it("resolves EXPO_PUBLIC_API_URL cleanly and defaults to port 4000", () => {
    const prev = globalThis.process?.env?.EXPO_PUBLIC_API_URL;
    try {
      delete globalThis.process.env.EXPO_PUBLIC_API_URL;
      assert.equal(resolveMobileApiBaseUrl(), "http://127.0.0.1:4000");

      globalThis.process.env.EXPO_PUBLIC_API_URL = "https://app.medisync.ma/";
      assert.equal(resolveMobileApiBaseUrl(), "https://app.medisync.ma");
    } finally {
      if (prev === undefined) delete globalThis.process.env.EXPO_PUBLIC_API_URL;
      else globalThis.process.env.EXPO_PUBLIC_API_URL = prev;
    }
  });

  it("validates scanned QR payloads before network dispatch and handles success responses", async () => {
    const bad = await verifyScannedQrPrescription(
      "http://127.0.0.1:4000",
      "tok",
      "",
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 400);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "http://127.0.0.1:4000/v1/clinical/prescriptions/verify-qr");
      assert.equal(init?.method, "POST");
      return new Response(
        JSON.stringify({ valid: true, prescription: { id: "rx-123" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const ok = await verifyScannedQrPrescription(
        "http://127.0.0.1:4000",
        "tok",
        "medisync:rx:v1:sample-valid-token",
      );
      assert.equal(ok.ok, true);
      assert.equal(ok.data?.valid, true);
      assert.equal(ok.data?.rxId, "rx-123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("executes presign -> S3 binary PUT -> confirm pipeline cleanly", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      if (String(url).endsWith("/presign-upload")) {
        return new Response(
          JSON.stringify({
            document: { id: "doc-uuid-1" },
            uploadUrl: "https://media.medisync.ma/bucket/key?sig=1",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      if (String(url).startsWith("https://media.medisync.ma/")) {
        return new Response(null, { status: 200 });
      }
      return new Response(
        JSON.stringify({
          document: {
            id: "doc-uuid-1",
            downloadUrl: "https://media.medisync.ma/bucket/key?dl=1",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const res = await uploadPickedBinaryMedia(
        "http://127.0.0.1:4000",
        "jwt-token",
        {
          category: "PRACTITIONER_LICENSE",
          fileName: "cnom-license.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        },
      );
      assert.equal(res.ok, true);
      assert.equal(res.data?.mediaId, "doc-uuid-1");
      assert.deepEqual(
        calls.map((c) => c.method),
        ["POST", "PUT", "POST"],
      );

      const badCat = await uploadPickedBinaryMedia(
        "http://127.0.0.1:4000",
        "jwt-token",
        {
          category: "INVALID_CATEGORY",
          fileName: "cnom-license.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        },
      );
      assert.equal(badCat.ok, false);
      assert.equal(badCat.status, 400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects out-of-range GPS coordinates and posts valid telemetry & catalog queries", async () => {
    const badGps = await transmitDriverGpsPing("http://127.0.0.1:4000", "tok", {
      lat: 999,
      lng: -7.6,
      status: "AVAILABLE",
    });
    assert.equal(badGps.ok, false);
    assert.equal(badGps.status, 400);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/v1/telemetry/mobile")) {
        return new Response(
          JSON.stringify({ accepted: true, receivedAt: "2026-11-23T02:00:00.000Z" }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ products: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const hb = await sendMobileTelemetryHeartbeat("http://127.0.0.1:4000", {
        platform: "android",
        appVersion: "2.0.0",
        countryCode: "MA",
        capabilities: {
          cameraQr: true,
          backgroundLocation: true,
          binaryMediaPicker: true,
        },
      });
      assert.equal(hb.ok, true);
      assert.equal(hb.data?.accepted, true);

      const cat = await fetchMobilePharmacyCatalog("http://127.0.0.1:4000", "MA");
      assert.equal(cat.ok, true);
      assert.deepEqual(cat.data, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles non-JSON 502 gateway errors and offline network rejections without throwing", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        });

      const qr502 = await verifyScannedQrPrescription(
        "http://127.0.0.1:4000",
        "tok",
        "medisync:rx:v1:sample-valid-token",
      );
      assert.equal(qr502.ok, false);
      assert.equal(qr502.status, 502);

      const cat502 = await fetchMobilePharmacyCatalog("http://127.0.0.1:4000", "MA");
      assert.equal(cat502.ok, false);
      assert.equal(cat502.status, 502);

      globalThis.fetch = async () => {
        throw new TypeError("fetch failed");
      };

      const offlinePing = await transmitDriverGpsPing("http://127.0.0.1:4000", "tok", {
        lat: 33.584,
        lng: -7.624,
        status: "AVAILABLE",
      });
      assert.equal(offlinePing.ok, false);
      assert.equal(offlinePing.status, 0);

      const offlineUpload = await uploadPickedBinaryMedia("http://127.0.0.1:4000", "tok", {
        category: "PRACTITIONER_LICENSE",
        fileName: "cnom.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      });
      assert.equal(offlineUpload.ok, false);
      assert.equal(offlineUpload.status, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
