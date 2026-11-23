import { expect, test, type Page } from "@playwright/test";

const MOCK_FACILITY_ID = "44444444-4444-4444-8444-444444444444";
const MOCK_LAB_ID = "55555555-5555-4555-8555-555555555555";
const MOCK_PHARMACY_ID = "77777777-7777-4777-8777-777777777777";
const MOCK_DOCTOR_ID = "33333333-3333-4333-8333-333333333333";
const MOCK_PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_SCHEDULE_ID = "99999999-9999-4999-8999-999999999999";
const MOCK_APPT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOCK_LAB_ORDER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MOCK_RX_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MOCK_ORDER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function seedSession(
  page: Page,
  overrides: {
    id?: string;
    role: string;
    fullName: string;
    email: string;
    countryCode?: string;
    facilityId?: string | null;
    accountStatus?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
    credentialVerified?: boolean;
  },
) {
  await page.addInitScript((userPatch) => {
    window.localStorage.setItem(
      "medisync.session.v1",
      JSON.stringify({
        token: "test-role-jwt",
        user: {
          id: userPatch.id ?? "33333333-3333-4333-8333-333333333333",
          email: userPatch.email,
          fullName: userPatch.fullName,
          role: userPatch.role,
          countryCode: userPatch.countryCode ?? "MA",
          facilityId:
            userPatch.facilityId === undefined
              ? "44444444-4444-4444-8444-444444444444"
              : userPatch.facilityId,
          avatarUrl: null,
          emailVerified: true,
          phone: "+212600000111",
          phoneVerified: true,
          authProvider: "LOCAL",
          accountStatus: userPatch.accountStatus ?? "ACTIVE",
          credentialVerified: userPatch.credentialVerified ?? true,
          lastLoginAtIso: "2026-11-14T12:00:00.000Z",
          createdAtIso: "2026-11-14T12:00:00.000Z",
        },
      }),
    );
  }, overrides);
}

async function mockCommonMoroccoNetwork(page: Page) {
  await page.route("**/api/backend-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ online: true }),
    }),
  );

  await page.route("**/v1/directory/patients*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        patients: [
          {
            id: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            email: "salma@medisync.ma",
            phone: "+212600000333",
            role: "PATIENT",
            countryCode: "MA",
            avatarUrl: null,
          },
        ],
      }),
    }),
  );

  await page.route("**/v1/directory/doctors*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        doctors: [
          {
            id: MOCK_DOCTOR_ID,
            fullName: "Dr. Youssef Berrada",
            email: "dr.berrada@medisync.ma",
            countryCode: "MA",
            specialty: "Cardiology",
            facilityId: MOCK_FACILITY_ID,
            facilityName: "CHU Ibn Rochd",
            consultationFeeMinor: 35000,
            credentialVerified: true,
          },
        ],
      }),
    }),
  );

  await page.route("**/v1/directory/facilities*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        facilities: [
          {
            id: MOCK_FACILITY_ID,
            name: "CHU Ibn Rochd",
            kind: "HOSPITAL",
            countryCode: "MA",
            licenseNumber: "MA-HOSP-101",
            verificationStatus: "VERIFIED",
            openStatus: "OPEN",
            address: "1 Rue des Hopitaux, Casablanca",
            lat: 33.575,
            lng: -7.619,
          },
          {
            id: MOCK_LAB_ID,
            name: "Laboratoire Pasteur Casablanca",
            kind: "DIAGNOSTIC_LAB",
            countryCode: "MA",
            licenseNumber: "MA-LAB-501",
            verificationStatus: "VERIFIED",
            openStatus: "OPEN",
            address: "Place Pasteur, Casablanca",
            lat: 33.586,
            lng: -7.615,
          },
          {
            id: MOCK_PHARMACY_ID,
            name: "Pharmacie Al Amal",
            kind: "PHARMACY",
            countryCode: "MA",
            licenseNumber: "MA-PHARM-301",
            verificationStatus: "VERIFIED",
            openStatus: "OPEN",
            address: "Bd Zerktouni, Casablanca",
            lat: 33.589,
            lng: -7.632,
          },
        ],
      }),
    }),
  );

  await page.route("**/v1/facilities*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        facilities: [
          {
            id: MOCK_FACILITY_ID,
            name: "CHU Ibn Rochd",
            kind: "HOSPITAL",
            countryCode: "MA",
            licenseNumber: "MA-HOSP-101",
            verificationStatus: "VERIFIED",
            lat: 33.575,
            lng: -7.619,
            address: "1 Rue des Hopitaux, Casablanca",
            ownerUserId: "66666666-6666-4666-8666-666666666666",
            createdAtIso: "2026-11-14T10:00:00.000Z",
          },
        ],
      }),
    }),
  );

  await page.route("**/v1/users/me/consents", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ consents: [] }),
    }),
  );
}

test.describe("Role-Dedicated Workspaces & Verification Gates", () => {
  test("verified doctor uses /clinical Calendar to inspect allergies, check in patient, and open Chart & Rx", async ({
    page,
  }) => {
    await seedSession(page, {
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Youssef Berrada",
      email: "dr.berrada@medisync.ma",
    });
    await mockCommonMoroccoNetwork(page);

    const todayDate = new Date().toISOString().slice(0, 10);
    let currentApptStatus = "CONFIRMED";
    let capturedTransitionStatus = "";

    await page.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: [] }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [] }),
      }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labOrders: [] }),
      }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mediaObjects: [] }),
      }),
    );
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schedules: [
            {
              id: MOCK_SCHEDULE_ID,
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              dayOfWeek: new Date(`${todayDate}T10:00:00.000Z`).getUTCDay(),
              startTimeUtc: "09:00",
              endTimeUtc: "13:00",
              slotDurationMinutes: 30,
              visitMode: "IN_PERSON",
              isActive: true,
              createdAtIso: "2026-11-14T08:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/clinical/patients/*/profile", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            userId: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            countryCode: "MA",
            dateOfBirth: "1992-05-14",
            biologicalSex: "FEMALE",
            bloodType: "O+",
            nationalHealthId: null,
            emergencyContactName: "Omar El Fassi",
            emergencyContactPhone: "+212600000444",
            heightCm: 168,
            weightKg: 62,
            allergies: [
              {
                allergen: "Penicillin",
                severity: "MODERATE",
                reaction: "Rash",
              },
            ],
            chronicConditions: ["Hypertension"],
            currentMedications: ["Amlodipine 5mg"],
            primaryDoctorUserId: MOCK_DOCTOR_ID,
            preferredFacilityId: MOCK_FACILITY_ID,
            dataSharingConsent: true,
            telehealthConsent: true,
            updatedAtIso: "2026-11-14T10:00:00.000Z",
          },
        }),
      }),
    );
    await page.route(`**/v1/booking/appointments/${MOCK_APPT_ID}/status`, async (route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}");
      capturedTransitionStatus = payload.status;
      currentApptStatus = payload.status;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointment: {
            id: MOCK_APPT_ID,
            countryCode: "MA",
            scheduleId: MOCK_SCHEDULE_ID,
            facilityId: MOCK_FACILITY_ID,
            facilityName: "CHU Ibn Rochd",
            doctorUserId: MOCK_DOCTOR_ID,
            doctorName: "Dr. Youssef Berrada",
            specialty: "Cardiology",
            patientUserId: MOCK_PATIENT_ID,
            patientName: "Salma El Fassi",
            bookedByUserId: MOCK_PATIENT_ID,
            visitMode: "IN_PERSON",
            slotStartIso: `${todayDate}T10:00:00.000Z`,
            slotEndIso: `${todayDate}T10:30:00.000Z`,
            status: currentApptStatus,
            reason: "Chest tightness follow-up",
            triageNote: null,
            createdAtIso: "2026-11-14T09:00:00.000Z",
            updatedAtIso: "2026-11-14T09:00:00.000Z",
          },
        }),
      });
    });
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointments: [
            {
              id: MOCK_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              bookedByUserId: MOCK_PATIENT_ID,
              visitMode: "IN_PERSON",
              slotStartIso: `${todayDate}T10:00:00.000Z`,
              slotEndIso: `${todayDate}T10:30:00.000Z`,
              status: currentApptStatus,
              reason: "Chest tightness follow-up",
              triageNote: null,
              createdAtIso: "2026-11-14T09:00:00.000Z",
              updatedAtIso: "2026-11-14T09:00:00.000Z",
            },
          ],
        }),
      }),
    );

    await page.goto("/clinical");

    // Doctor defaults to Clients & Calendar tab and hides Pharmacy QR Dispense tab
    await expect(page.getByRole("tab", { name: /Clients & Calendar/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("tab", { name: /Pharmacy QR Dispense/i }),
    ).toHaveCount(0);

    // Patient Safety & Allergies alert is visible right in the clinical view
    await expect(page.getByText(/Penicillin/i).first()).toBeVisible();
    await expect(page.getByText("Salma El Fassi").first()).toBeVisible();

    await page.getByRole("button", { name: /Check In/i }).click();
    await expect.poll(() => capturedTransitionStatus).toBe("CHECKED_IN");

    await page.getByRole("button", { name: /Open Chart & Rx/i }).click();
    await expect(page.getByRole("tab", { name: /Consultation & E-Rx/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#clin-patient-uuid")).toHaveValue(MOCK_PATIENT_ID);
  });

  test("verified hospital admin manages facility readiness, checks in patient, and opens live map on /hospital", async ({
    page,
  }) => {
    await seedSession(page, {
      id: "66666666-6666-4666-8666-666666666666",
      role: "HOSPITAL_ADMIN",
      fullName: "Nadia Mansouri",
      email: "nadia.admin@chu-casablanca.ma",
      facilityId: MOCK_FACILITY_ID,
    });
    await mockCommonMoroccoNetwork(page);
    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "66666666-6666-4666-8666-666666666666",
            role: "HOSPITAL_ADMIN",
            fullName: "Nadia Mansouri",
            email: "nadia.admin@chu-casablanca.ma",
            countryCode: "MA",
            facilityId: MOCK_FACILITY_ID,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000111",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      }),
    );

    let openStatus = "OPEN";
    let patchedStatus = "";
    let apptStatus = "CONFIRMED";
    const todayDate = new Date().toISOString().slice(0, 10);

    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 5,
          facilities: [
            {
              id: MOCK_FACILITY_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: "66666666-6666-4666-8666-666666666666",
              createdAtIso: "2026-11-14T10:00:00.000Z",
              openStatus,
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 200,
            },
          ],
        }),
      }),
    );

    await page.route(
      `**/v1/maps/facilities/${MOCK_FACILITY_ID}/operational-status`,
      async (route) => {
        const body = JSON.parse(route.request().postData() ?? "{}");
        patchedStatus = body.openStatus;
        openStatus = body.openStatus;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            facility: {
              id: MOCK_FACILITY_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: "66666666-6666-4666-8666-666666666666",
              createdAtIso: "2026-11-14T10:00:00.000Z",
              openStatus: body.openStatus,
              is24_7: Boolean(body.is24_7),
              acceptsEmergency: Boolean(body.acceptsEmergency),
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: null,
            },
          }),
        });
      },
    );

    await page.route(/\/v1\/booking\/appointments/, async (route) => {
      if (route.request().method() === "PATCH") {
        apptStatus = "CHECKED_IN";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            appointment: {
              id: MOCK_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              bookedByUserId: MOCK_PATIENT_ID,
              visitMode: "IN_PERSON",
              slotStartIso: `${todayDate}T11:00:00.000Z`,
              slotEndIso: `${todayDate}T11:30:00.000Z`,
              status: apptStatus,
              reason: "ER reception intake",
              triageNote: null,
              createdAtIso: "2026-11-14T09:00:00.000Z",
              updatedAtIso: "2026-11-14T09:00:00.000Z",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointments: [
            {
              id: MOCK_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              bookedByUserId: MOCK_PATIENT_ID,
              visitMode: "IN_PERSON",
              slotStartIso: `${todayDate}T11:00:00.000Z`,
              slotEndIso: `${todayDate}T11:30:00.000Z`,
              status: apptStatus,
              reason: "ER reception intake",
              triageNote: null,
              createdAtIso: "2026-11-14T09:00:00.000Z",
              updatedAtIso: "2026-11-14T09:00:00.000Z",
            },
          ],
        }),
      });
    });

    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dispatches: [] }),
      }),
    );

    await page.route("**/v1/dispatch/stream*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: snapshot\ndata: {"type":"snapshot","countryCode":"MA","timestampIso":"2026-11-14T12:00:00.000Z"}\n\n',
      }),
    );

    await page.route("**/v1/billing/invoices*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invoices: [] }),
      }),
    );

    await page.route("**/v1/clinical/patients/*/insurances*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ policies: [] }),
      }),
    );

    await page.goto("/hospital");

    await expect(
      page.getByRole("heading", { name: /Facility Readiness, Reception/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Insurance Verification & Reception Billing/i }),
    ).toBeVisible();
    await expect(page.locator('a[href="/clinical"], a[href="/lab"]')).toHaveCount(0);
    await page.getByRole("button", { name: /Set High Demand/i }).click();
    await expect.poll(() => patchedStatus).toBe("BUSY");

    await page.getByRole("button", { name: /Check In/i }).click();
    await expect(page.getByText(/Salma El Fassi marked CHECKED_IN/i)).toBeVisible();

    await page.getByRole("button", { name: /Open Live Map/i }).click();
    await expect(
      page.getByRole("region", { name: /Interactive street map/i }),
    ).toBeVisible();
  });

  test("pending lab technician is gated on /lab without firing protected clinical APIs, while verified lab tech completes orders", async ({
    page,
  }) => {
    await seedSession(page, {
      id: "55555555-0000-4000-8000-555555555555",
      role: "LAB_TECH",
      fullName: "Imane Bennani",
      email: "imane.lab@medisync.ma",
      facilityId: MOCK_LAB_ID,
      accountStatus: "PENDING_APPROVAL",
      credentialVerified: false,
    });
    await mockCommonMoroccoNetwork(page);

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "55555555-0000-4000-8000-555555555555",
            role: "LAB_TECH",
            fullName: "Imane Bennani",
            email: "imane.lab@medisync.ma",
            countryCode: "MA",
            facilityId: MOCK_LAB_ID,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000111",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "PENDING_APPROVAL",
            credentialVerified: false,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      }),
    );

    let protectedCalled = false;
    await page.route(/\/v1\/clinical\/lab-orders/, (route) => {
      protectedCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labOrders: [] }),
      });
    });

    await page.goto("/lab");
    await expect(page.getByText(/Pending Admin Verification/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Complete & Release Result/i }),
    ).toHaveCount(0);
    expect(protectedCalled).toBe(false);

    // Verify a verified lab tech session completes a diagnostic order
    const verifiedPage = await page.context().newPage();
    await seedSession(verifiedPage, {
      id: "55555555-0000-4000-8000-555555555555",
      role: "LAB_TECH",
      fullName: "Imane Bennani",
      email: "imane.lab@medisync.ma",
      facilityId: MOCK_LAB_ID,
      accountStatus: "ACTIVE",
      credentialVerified: true,
    });
    await mockCommonMoroccoNetwork(verifiedPage);
    await verifiedPage.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "55555555-0000-4000-8000-555555555555",
            role: "LAB_TECH",
            fullName: "Imane Bennani",
            email: "imane.lab@medisync.ma",
            countryCode: "MA",
            facilityId: MOCK_LAB_ID,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000111",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      }),
    );

    let labStatus = "ORDERED";
    await verifiedPage.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: [] }),
      }),
    );
    await verifiedPage.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [] }),
      }),
    );
    await verifiedPage.route("**/v1/clinical/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mediaObjects: [] }),
      }),
    );
    await verifiedPage.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schedules: [] }),
      }),
    );
    await verifiedPage.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ appointments: [] }),
      }),
    );
    await verifiedPage.route(/\/v1\/clinical\/lab-orders/, async (route) => {
      if (route.request().method() === "PATCH") {
        labStatus = "COMPLETED";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            labOrder: {
              id: MOCK_LAB_ORDER_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              orderedByDoctorId: MOCK_DOCTOR_ID,
              orderedByDoctorName: "Dr. Youssef Berrada",
              facilityId: MOCK_LAB_ID,
              facilityName: "Laboratoire Pasteur Casablanca",
              appointmentId: null,
              panelName: "Complete Blood Count (CBC)",
              urgency: "ROUTINE",
              clinicalNotes: null,
              status: labStatus,
              resultSummary: "Reviewed and signed off in diagnostic portal.",
              reportObjectKey: null,
              createdAtIso: "2026-11-14T10:00:00.000Z",
              updatedAtIso: "2026-11-14T10:30:00.000Z",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          labOrders: [
            {
              id: MOCK_LAB_ORDER_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              orderedByDoctorId: MOCK_DOCTOR_ID,
              orderedByDoctorName: "Dr. Youssef Berrada",
              facilityId: MOCK_LAB_ID,
              facilityName: "Laboratoire Pasteur Casablanca",
              appointmentId: null,
              panelName: "Complete Blood Count (CBC)",
              urgency: "ROUTINE",
              clinicalNotes: null,
              status: labStatus,
              resultSummary: null,
              reportObjectKey: null,
              createdAtIso: "2026-11-14T10:00:00.000Z",
              updatedAtIso: "2026-11-14T10:00:00.000Z",
            },
          ],
        }),
      });
    });

    await verifiedPage.goto("/lab");
    await expect(verifiedPage.getByRole("tab")).toHaveCount(2);
    await expect(
      verifiedPage.getByRole("tab", { name: /ISO 15189 & Lab Papers/i }),
    ).toBeVisible();
    await expect(
      verifiedPage.getByRole("tab", { name: /Consultation & E-Rx/i }),
    ).toHaveCount(0);
    await expect(
      verifiedPage.getByText(/Complete Blood Count \(CBC\)/i).first(),
    ).toBeVisible();
    await verifiedPage
      .getByRole("button", { name: /Complete & Release Result/i })
      .click();
    await expect(
      verifiedPage.getByText(
        /Diagnostic report finalized for Complete Blood Count \(CBC\)/i,
      ),
    ).toBeVisible();
    await verifiedPage.close();
  });

  test("verified pharmacist auto-opens QR Rx Dispense tab, verifies & dispenses Rx, and dispatches courier on /pharmacy", async ({
    page,
  }) => {
    await seedSession(page, {
      id: "77777777-0000-4000-8000-777777777777",
      role: "PHARMACIST",
      fullName: "Dr. Karim Tazi",
      email: "pharmacist@al-amal.ma",
      facilityId: MOCK_PHARMACY_ID,
    });
    await mockCommonMoroccoNetwork(page);

    let rxStatus = "ISSUED";
    let orderStatus = "PREPARING";
    let courierDispatched = false;

    const mockRx = () => ({
      id: MOCK_RX_ID,
      countryCode: "MA",
      patientUserId: MOCK_PATIENT_ID,
      patientName: "Salma El Fassi",
      doctorUserId: MOCK_DOCTOR_ID,
      doctorName: "Youssef Berrada",
      facilityId: MOCK_FACILITY_ID,
      medications: [
        {
          name: "Amoxicillin 500mg",
          dosage: "500 mg",
          frequency: "Twice daily",
          durationDays: 7,
          instructions: "Take after meals",
        },
      ],
      notes: "Complete full antibiotic course",
      qrToken: "MEDISYNC-RX-2026-VALID-TOKEN-9911",
      qrSignature: "sig-valid-001",
      status: rxStatus,
      dispensedByUserId: rxStatus === "DISPENSED" ? "77777777-0000-4000-8000-777777777777" : null,
      pharmacyFacilityId: rxStatus === "DISPENSED" ? MOCK_PHARMACY_ID : null,
      dispensedAtIso: rxStatus === "DISPENSED" ? "2026-11-14T12:15:00.000Z" : null,
      dispensingNote: rxStatus === "DISPENSED" ? "Lot #MA-402 released" : null,
      issuedAtIso: "2026-11-14T11:00:00.000Z",
    });

    await page.route("**/v1/pharmacy/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      }),
    );

    await page.route(/\/v1\/pharmacy\/orders/, async (route) => {
      if (route.request().method() === "PATCH") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        orderStatus = body.status;
        if (orderStatus === "OUT_FOR_DELIVERY") courierDispatched = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            order: {
              id: MOCK_ORDER_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Al Amal",
              prescriptionId: MOCK_RX_ID,
              fulfillmentMode: "COURIER_DELIVERY",
              deliveryAddress: "240 Bd d'Anfa, Casablanca",
              dispatchRequestId: null,
              status: orderStatus,
              currencyCode: "MAD",
              subtotalMinor: 12000,
              deliveryFeeMinor: 2500,
              totalMinor: 14500,
              paymentMethod: "CARD_SIMULATED",
              paymentReference: "PAY-MA-001",
              receiptNumber: "RCP-MA-901",
              notes: null,
              paidAtIso: "2026-11-14T11:10:00.000Z",
              createdAtIso: "2026-11-14T11:05:00.000Z",
              updatedAtIso: "2026-11-14T11:20:00.000Z",
              items: [],
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          orders: [
            {
              id: MOCK_ORDER_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Al Amal",
              prescriptionId: MOCK_RX_ID,
              fulfillmentMode: "COURIER_DELIVERY",
              deliveryAddress: "240 Bd d'Anfa, Casablanca",
              dispatchRequestId: null,
              status: orderStatus,
              currencyCode: "MAD",
              subtotalMinor: 12000,
              deliveryFeeMinor: 2500,
              totalMinor: 14500,
              paymentMethod: "CARD_SIMULATED",
              paymentReference: "PAY-MA-001",
              receiptNumber: "RCP-MA-901",
              notes: null,
              paidAtIso: "2026-11-14T11:10:00.000Z",
              createdAtIso: "2026-11-14T11:05:00.000Z",
              updatedAtIso: "2026-11-14T11:20:00.000Z",
              items: [],
            },
          ],
        }),
      });
    });

    await page.route("**/v1/clinical/prescriptions", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [mockRx()] }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [mockRx()] }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions/verify-qr", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid: true, prescription: mockRx() }),
      }),
    );
    await page.route(`**/v1/clinical/prescriptions/${MOCK_RX_ID}/dispense`, (route) => {
      rxStatus = "DISPENSED";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescription: mockRx() }),
      });
    });

    await page.goto("/pharmacy");

    await expect(
      page.getByRole("heading", { name: /Pharmacist QR Dispense & Courier Desk/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Catalog & Checkout/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /QR Rx Dispense/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: /E-Prescription QR Verification Desk/i }),
    ).toBeVisible();

    await page.locator("#pharma-qr-input").fill("MEDISYNC-RX-2026-VALID-TOKEN-9911");
    await page.getByRole("button", { name: /Verify QR Prescription/i }).click();
    await expect(page.getByText(/Amoxicillin 500mg/i).first()).toBeVisible();

    await page.locator("#pharma-dispense-note").fill("Lot #MA-402 released");
    await page.getByRole("button", { name: /Confirm Dispense & Release/i }).click();
    await expect(
      page.getByText(/Dispensed Amoxicillin 500mg to Salma El Fassi/i),
    ).toBeVisible();

    await page.getByRole("tab", { name: /Orders & Receipts/i }).click();
    await page.getByRole("button", { name: /Dispatch Courier/i }).click();
    await expect.poll(() => courierDispatched).toBe(true);
  });

  test("patient tracks approaching driver -> destination hospital route on /map and cancels pending dispatch", async ({
    page,
  }) => {
    const MOCK_DRIVER_USER_ID = "11111111-1111-4111-8111-111111111111";
    const MOCK_DISPATCH_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    await seedSession(page, {
      id: MOCK_PATIENT_ID,
      role: "PATIENT",
      fullName: "Salma El Fassi",
      email: "salma@medisync.ma",
      facilityId: null,
    });
    await mockCommonMoroccoNetwork(page);

    let dispatchStatus: "REQUESTED" | "EN_ROUTE" | "CANCELLED" = "EN_ROUTE";
    let assignedDriverId: string | null = MOCK_DRIVER_USER_ID;
    let selectedTargetFacility: string | null = MOCK_FACILITY_ID;

    const buildDispatch = () => ({
      id: MOCK_DISPATCH_ID,
      countryCode: "MA",
      patientUserId: MOCK_PATIENT_ID,
      driverUserId: assignedDriverId,
      targetFacilityId: selectedTargetFacility,
      pickupLat: 33.586,
      pickupLng: -7.624,
      pickupAddress: "Boulevard Zerktouni Corner",
      urgency: "URGENT" as const,
      status: dispatchStatus,
      notes: null,
      createdAtIso: "2026-11-14T12:00:00.000Z",
      updatedAtIso: "2026-11-14T12:05:00.000Z",
    });

    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 3,
          facilities: [
            {
              id: MOCK_FACILITY_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: MOCK_DOCTOR_ID,
              createdAtIso: "2026-11-14T10:00:00.000Z",
              openStatus: "OPEN",
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 620,
            },
          ],
        }),
      }),
    );

    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          drivers: [
            {
              id: MOCK_DRIVER_USER_ID,
              fullName: "Karim Benali",
              email: "karim@medisync.ma",
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              vehicleType: "AMBULANCE",
              vehicleLabel: "SAMU-MA-07",
              serviceZone: "Casablanca-Settat",
              liveStatus: "EN_ROUTE",
              avatarUrl: null,
            },
          ],
        }),
      }),
    );

    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 2,
          drivers: [
            {
              driverId: MOCK_DRIVER_USER_ID,
              countryCode: "MA",
              lat: 33.581,
              lng: -7.629,
              headingDeg: 45,
              status: "EN_ROUTE",
              distanceKm: 0.7,
              recordedAtIso: "2026-11-14T12:04:00.000Z",
            },
          ],
        }),
      }),
    );

    await page.route(/\/v1\/dispatch\/requests(\?.*)?$/, async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          targetFacilityId?: string;
        };
        selectedTargetFacility = body.targetFacilityId ?? MOCK_FACILITY_ID;
        dispatchStatus = "REQUESTED";
        assignedDriverId = null;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ dispatch: buildDispatch() }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dispatches: [buildDispatch()] }),
      });
    });

    await page.route(`**/v1/dispatch/requests/${MOCK_DISPATCH_ID}/status`, async (route) => {
      dispatchStatus = "CANCELLED";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dispatch: buildDispatch() }),
      });
    });

    await page.route("**/v1/dispatch/stream*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: snapshot\ndata: {"type":"snapshot","countryCode":"MA","timestampIso":"2026-11-14T12:00:00.000Z"}\n\n',
      }),
    );

    await page.goto("/map?layer=DRIVER");

    const tracker = page.getByLabel("Live Approaching Transport Tracker");
    await expect(tracker).toBeVisible();
    await expect(tracker.getByText(/Karim Benali · SAMU-MA-07/i)).toBeVisible();
    await expect(tracker.getByText(/km away/i)).toBeVisible();
    await expect(tracker.getByText(/Destination:\s*CHU Ibn Rochd/i)).toBeVisible();

    // Shared map overlays: Pickup pin, Your Driver pin, Drop-off pin, and dual-leg SVG route lines
    await expect(
      page.getByRole("button", { name: /Your pickup Boulevard Zerktouni Corner/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Your assigned driver unit/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /CHU Ibn Rochd.*Destination/i }),
    ).toBeVisible();
    await expect(
      page.locator('svg polyline[data-route-leg="pickup"]'),
    ).toBeAttached();
    await expect(
      page.locator('svg polyline[data-route-leg="dropoff"]'),
    ).toBeAttached();
    await expect(page.locator('[data-map-route-summary="true"]')).toBeVisible();
    await expect(page.locator('[data-map-route-summary="true"]')).toContainText(/min/i);
    await expect(page.locator('[data-map-route-summary="true"]')).toContainText(/km/i);

    // Zoom way out beyond street level and verify route polylines + ETA/distance remain visible
    const zoomOutBtn = page.getByRole("button", { name: /Zoom out viewport/i });
    for (let i = 0; i < 6; i += 1) {
      await zoomOutBtn.click();
    }
    await expect(
      page.locator('svg polyline[data-route-leg="pickup"]'),
    ).toBeAttached();
    await expect(
      page.locator('svg polyline[data-route-leg="dropoff"]'),
    ).toBeAttached();
    await expect(page.locator('[data-map-route-summary="true"]')).toBeVisible();

    // Center, zoom in cleanly so CHU Ibn Rochd leaves the right edge while Driver/Pickup stay visible
    await page.getByRole("button", { name: /Center map on region/i }).click();
    const zoomInBtn = page.getByRole("button", { name: /Zoom in viewport/i });
    await zoomInBtn.click();
    await zoomInBtn.click();
    const mapRegion = page.getByRole("region", { name: /Interactive street map/i });
    const box = await mapRegion.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.35, {
        steps: 8,
      });
      await page.mouse.up();
    }
    await expect(
      page.locator('svg polyline[data-route-leg]').first(),
    ).toBeAttached();
    await expect(page.locator('[data-map-route-summary="true"]')).toBeVisible();
    await page.getByRole("button", { name: /Center map on region/i }).click();

    // Open 1-Tap Fast Book -> verify auto-detected pickup & map-pin destination (no dropdown/input) -> book -> cancel
    await tracker.getByRole("button", { name: /New Fast Book/i }).click();
    await expect(
      page.getByLabel("Auto-detected pickup location"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Destination hospital or clinic"),
    ).toHaveCount(0);
    await expect(page.getByLabel("Fast book pickup landmark")).toHaveCount(0);

    await page
      .getByRole("button", { name: /CHU Ibn Rochd/i })
      .first()
      .click();
    await expect(
      page.getByLabel("Fast book destination facility").getByText(/Selected from Map/i),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Fast Book Nearest Driver/i })
      .click();

    await expect(tracker.getByRole("button", { name: /Cancel Request/i })).toBeVisible();
    await tracker.getByRole("button", { name: /Cancel Request/i }).click();
    await expect(tracker).not.toBeVisible();
  });

  test("staff portal enforces work email + onboarding checklist and admin verifies pending worker on /admin", async ({
    page,
  }) => {
    const PENDING_STAFF_ID = "77777777-1111-4111-8111-777777777777";
    await mockCommonMoroccoNetwork(page);

    await page.route("**/v1/auth/personas*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ personas: [] }),
      }),
    );

    await page.goto("/pro");
    await page.getByRole("tab", { name: /Join by Field/i }).click();
    await expect(page.getByText(/Work Email \*/i)).toBeVisible();
    await expect(
      page.getByText(/Required for staff credentials & paper verification/i),
    ).toBeVisible();

    // Seed pending Doctor session on /pro to verify guided checklist
    await seedSession(page, {
      id: PENDING_STAFF_ID,
      role: "DOCTOR",
      fullName: "Dr. Nadia Tazi",
      email: "nadia.tazi@medisync.ma",
      facilityId: null,
      accountStatus: "PENDING_APPROVAL",
      credentialVerified: false,
    });
    await page.route("**/v1/media/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: PENDING_STAFF_ID,
            email: "nadia.tazi@medisync.ma",
            fullName: "Dr. Nadia Tazi",
            role: "DOCTOR",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000111",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "PENDING_APPROVAL",
            credentialVerified: false,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      }),
    );

    await page.goto("/pro");
    const checklist = page.getByLabel("Worker Verification Onboarding");
    await expect(checklist).toBeVisible();
    await expect(checklist.getByText(/Complete Your Papers & Workplace/i)).toBeVisible();
    await expect(checklist.getByRole("button", { name: /\+ Add Own Place/i })).toBeVisible();

    // Verify Admin approves pending worker on /admin
    await seedSession(page, {
      id: "99999999-1111-4111-8111-999999999999",
      role: "OPS_ADMIN",
      fullName: "Tariq Alami",
      email: "admin@medisync.ma",
      facilityId: null,
      accountStatus: "ACTIVE",
      credentialVerified: true,
    });

    let approvedInAdmin = false;
    await page.route("**/v1/admin/overview*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overview: {
            countryCode: "MA",
            totalUsers: 2,
            totalFacilities: 1,
            pendingVerificationFacilities: 0,
            activeDispatches: 0,
            activeAppointments: 0,
            openPrescriptions: 0,
            pendingLabOrders: 0,
            openDisputes: 0,
            recentAuditLogs: [],
          },
        }),
      }),
    );
    await page.route("**/v1/admin/users*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              id: PENDING_STAFF_ID,
              email: "nadia.tazi@medisync.ma",
              fullName: "Dr. Nadia Tazi",
              role: "DOCTOR",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000888",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: approvedInAdmin ? "ACTIVE" : "PENDING_APPROVAL",
              credentialVerified: approvedInAdmin,
              lastLoginAtIso: "2026-11-14T12:00:00.000Z",
              createdAtIso: "2026-11-14T12:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/admin/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/admin/audit-logs*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [] }) }),
    );
    await page.route("**/v1/admin/audit-events*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [] }) }),
    );
    await page.route("**/v1/admin/facility-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/user-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/users/*/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }),
    );
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ appointments: [] }) }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prescriptions: [] }) }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );
    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "99999999-1111-4111-8111-999999999999",
            email: "admin@medisync.ma",
            fullName: "Tariq Alami",
            role: "OPS_ADMIN",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000111",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dispatches: [] }) }),
    );
    await page.route(`**/v1/admin/users/${PENDING_STAFF_ID}/status`, async (route) => {
      approvedInAdmin = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: PENDING_STAFF_ID,
            email: "nadia.tazi@medisync.ma",
            fullName: "Dr. Nadia Tazi",
            role: "DOCTOR",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000888",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-14T12:00:00.000Z",
            createdAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("/admin");
    await expect(page.getByText("Dr. Nadia Tazi").first()).toBeVisible();
    await page.getByRole("button", { name: /Verify & Activate/i }).first().click();
    await expect.poll(() => approvedInAdmin).toBe(true);
  });

  test("patient manages Emergency Safety Profile (EHR allergies & blood type), Insurance cards, and live ride tracking on /patient", async ({
    page,
  }) => {
    await seedSession(page, {
      id: MOCK_PATIENT_ID,
      role: "PATIENT",
      fullName: "Salma El Fassi",
      email: "salma@medisync.ma",
      facilityId: null,
    });
    await mockCommonMoroccoNetwork(page);

    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ drivers: [] }) }),
    );
    await page.route("**/v1/directory/services*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) }),
    );
    await page.route(/\/v1\/booking\/appointments/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ appointments: [] }) }),
    );
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispatches: [
            {
              id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              driverUserId: null,
              targetFacilityId: MOCK_FACILITY_ID,
              pickupLat: 33.586,
              pickupLng: -7.624,
              pickupAddress: "Maarif Street 18, Casablanca",
              urgency: "URGENT",
              status: "EN_ROUTE",
              notes: null,
              createdAtIso: "2026-11-14T12:00:00.000Z",
              updatedAtIso: "2026-11-14T12:05:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ visitNotes: [] }) }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prescriptions: [] }) }),
    );
    await page.route(/\/v1\/clinical\/lab-orders/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mediaObjects: [] }) }),
    );

    let savedBloodType = "O+";
    let savedAllergies = [{ allergen: "Latex", severity: "MILD" }];
    await page.route("**/v1/clinical/patients/me/profile", async (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON() as {
          bloodType: string;
          allergies: Array<{ allergen: string; severity: string }>;
        };
        savedBloodType = body.bloodType;
        savedAllergies = body.allergies;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            userId: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            countryCode: "MA",
            dateOfBirth: "1992-05-14",
            biologicalSex: "FEMALE",
            bloodType: savedBloodType,
            nationalHealthId: null,
            emergencyContactName: "Omar El Fassi",
            emergencyContactPhone: "+212600000444",
            heightCm: 168,
            weightKg: 62,
            allergies: savedAllergies,
            chronicConditions: ["Asthma"],
            currentMedications: [],
            primaryDoctorUserId: null,
            preferredFacilityId: null,
            dataSharingConsent: true,
            telehealthConsent: true,
            updatedAtIso: "2026-11-14T12:00:00.000Z",
          },
        }),
      });
    });

    const policiesList: Array<Record<string, unknown>> = [];
    await page.route("**/v1/clinical/patients/me/insurances", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          providerName: string;
          policyNumber: string;
          memberId: string;
          coveragePlan: string;
          coveragePercent: number;
        };
        const created = {
          id: "98989898-9898-4898-8898-989898989898",
          userId: MOCK_PATIENT_ID,
          countryCode: "MA",
          providerName: body.providerName,
          policyNumber: body.policyNumber,
          memberId: body.memberId,
          coveragePlan: body.coveragePlan,
          coveragePercent: body.coveragePercent,
          validUntil: null,
          isPrimary: true,
          verificationStatus: "PENDING",
          cardMediaId: null,
          createdAtIso: "2026-11-14T12:00:00.000Z",
          updatedAtIso: "2026-11-14T12:00:00.000Z",
        };
        policiesList.unshift(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ policy: created }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ policies: policiesList }),
      });
    });

    await page.goto("/patient");

    await expect(
      page.getByRole("link", { name: /Track Live Driver on Map/i }),
    ).toBeVisible();

    await page.locator("#patient-blood-type").selectOption("AB-");
    await page.getByLabel("New allergen name").fill("Penicillin");
    await page.getByRole("button", { name: /^Add$/i }).click();
    await page.getByRole("button", { name: /Save Safety Profile/i }).click();
    await expect(page.getByText(/Emergency Safety Profile updated/i)).toBeVisible();
    await expect.poll(() => savedBloodType).toBe("AB-");
    expect(savedAllergies.some((a) => a.allergen === "Penicillin")).toBe(true);

    await page.getByLabel("Insurance provider name").fill("CNOPS");
    await page.getByLabel("Insurance policy number").fill("CN-9041");
    await page.getByLabel("Insurance member ID").fill("MA-8812");
    await page.getByRole("button", { name: /Link Insurance Policy/i }).click();
    await expect(page.getByText(/CNOPS · CNSS \/ AMO/i)).toBeVisible();
  });

  test("non-patient DRIVER session suppresses unauthorized /patient, /pharmacy, and /booking fetches while /portal syncs status on reload", async ({
    page,
  }) => {
    const DRIVER_ID = "44444444-1111-4111-8111-444444444444";
    await seedSession(page, {
      id: DRIVER_ID,
      role: "DRIVER",
      fullName: "Yassine Chauffeur",
      email: "driver.ma@medisync.global",
      accountStatus: "ACTIVE",
      credentialVerified: true,
    });
    await mockCommonMoroccoNetwork(page);

    const forbiddenEndpointsCalled: string[] = [];
    for (const pattern of [
      "**/v1/booking/appointments*",
      "**/v1/clinical/visit-notes*",
      "**/v1/clinical/prescriptions*",
      "**/v1/clinical/lab-orders*",
      "**/v1/clinical/media*",
      "**/v1/clinical/patients/me/profile",
      "**/v1/clinical/patients/me/insurances",
    ]) {
      await page.route(pattern, (route) => {
        forbiddenEndpointsCalled.push(route.request().url());
        return route.fulfill({ status: 403, body: JSON.stringify({ error: "FORBIDDEN" }) });
      });
    }

    await page.route("**/v1/services*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ services: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dispatches: [] }),
      }),
    );
    await page.route("**/v1/pharmacy/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ orders: [] }),
      }),
    );
    await page.route("**/v1/booking/slots*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slots: [] }),
      }),
    );

    await page.goto("/patient");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Driver Relay Workspace/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /1-Tap Fast Book Ride/i }),
    ).toHaveCount(0);

    await page.goto("/pharmacy");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Catalog & Checkout/i }),
    ).toHaveCount(0);

    await page.goto("/booking");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByText(/Available Practitioners & Time Windows/i),
    ).toHaveCount(0);

    await page.goto("/map");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Driver Relay Workspace/i }),
    ).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL(/\/driver$/);

    expect(forbiddenEndpointsCalled).toEqual([]);

    // Verify DRIVER header logo and Menu are strictly scoped to Driver + Portal and block /clinical & /admin
    await expect(
      page.locator('header a[href="/driver"]', { hasText: "MediSync" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Open navigation and language menu/i })
      .click();
    const driverMenuNav = page.getByRole("navigation", {
      name: "Sidebar Workspace Navigation",
    });
    await expect(driverMenuNav.getByRole("link", { name: /Driver Workspace/i })).toBeVisible();
    await expect(driverMenuNav.locator('a[href="/"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/clinical"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/admin"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/hospital"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/patient"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/booking"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/profiles"]')).toHaveCount(0);
    await expect(driverMenuNav.locator('a[href="/map"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Sign Out of Staff Session/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/clinical");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Driver Relay Workspace/i }),
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();

    // Verify verified login on /portal immediately auto-redirects staff into their isolated workspace
    await page.addInitScript(() => window.localStorage.clear());
    await page.evaluate(() => window.localStorage.clear());
    await page.route("**/v1/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "e2e-driver-login-token",
          user: {
            id: DRIVER_ID,
            email: "driver.ma@medisync.global",
            fullName: "Yassine Chauffeur",
            role: "DRIVER",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: null,
            phoneVerified: false,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-15T12:00:00.000Z",
            createdAtIso: "2026-11-15T12:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/auth/personas*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ personas: [] }) }),
    );
    await page.goto("/portal?track=staff");
    await expect(page).toHaveURL(/\/pro$/);
    await page.getByLabel(/Work Email or Phone Number/i).fill("driver.ma@medisync.global");
    await page.getByLabel(/Password/i).fill("DemoPass123!");
    await page.getByRole("button", { name: /Sign In as Staff Member/i }).click();
    await expect(page).toHaveURL(/\/driver$/);

    // Verify /pro reload auto-syncs pending staff approval and loads facilities
    await seedSession(page, {
      id: "77777777-2222-4222-8222-777777777777",
      role: "DOCTOR",
      fullName: "Dr. Amina Benali",
      email: "amina.doc@medisync.ma",
      accountStatus: "PENDING_APPROVAL",
      credentialVerified: false,
    });
    await page.route("**/v1/auth/personas*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ personas: [] }) }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "77777777-2222-4222-8222-777777777777",
            email: "amina.doc@medisync.ma",
            fullName: "Dr. Amina Benali",
            role: "DOCTOR",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: null,
            phoneVerified: false,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-15T12:00:00.000Z",
            createdAtIso: "2026-11-15T12:00:00.000Z",
          },
        }),
      }),
    );

    await page.goto("/pro");
    await expect(
      page.getByText(/Administration Verified · Workspace Active/i),
    ).toBeVisible();
    await expect(page.getByText("CHU Ibn Rochd", { exact: true }).first()).toBeVisible();
  });

  test("profile dossier opens facility -> practitioner with live slots and /portal manages profile, password rotation & server logout", async ({
    page,
  }) => {
    await mockCommonMoroccoNetwork(page);
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ drivers: [] }) }),
    );
    const todayIso = new Date().toISOString().slice(0, 10);
    await page.route("**/v1/booking/slots*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: todayIso,
          slots: [
            {
              scheduleId: MOCK_SCHEDULE_ID,
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              countryCode: "MA",
              visitMode: "IN_PERSON",
              consultationFeeMinor: 35000,
              slotStartIso: `${todayIso}T09:00:00.000Z`,
              slotEndIso: `${todayIso}T09:30:00.000Z`,
              isAvailable: true,
            },
          ],
        }),
      }),
    );

    await page.goto("/profiles");
    await page.getByRole("button", { name: /Team & Info/i }).first().click();
    const dossier = page.getByRole("dialog", { name: "Healthcare Profile Details" });
    await expect(dossier).toBeVisible();
    await expect(dossier.getByText(/Medical Staff & Units at This Location/i)).toBeVisible();
    await dossier.getByRole("button", { name: /Dr\. Youssef Berrada/i }).click();
    await expect(dossier.getByText(/Today's Open Windows/i)).toBeVisible();
    await expect(dossier.getByText("09:00").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Signed-in patient views Account Profile & Security on /portal and revokes sessions / logs out cleanly
    let logoutCalled = false;
    let passwordChanged = false;
    let sessionsRevoked = false;
    await seedSession(page, {
      id: MOCK_PATIENT_ID,
      role: "PATIENT",
      fullName: "Salma El Fassi",
      email: "salma@medisync.ma",
      accountStatus: "ACTIVE",
      credentialVerified: false,
    });
    await page.route("**/v1/auth/personas*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ personas: [] }) }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: MOCK_PATIENT_ID,
            email: "salma@medisync.ma",
            fullName: "Salma El Fassi",
            role: "PATIENT",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000333",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: false,
            lastLoginAtIso: "2026-11-15T12:00:00.000Z",
            createdAtIso: "2026-11-15T12:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/auth/change-password", (route) => {
      passwordChanged = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "rotated-patient-jwt",
          user: {
            id: MOCK_PATIENT_ID,
            email: "salma@medisync.ma",
            fullName: "Salma El Fassi",
            role: "PATIENT",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: "+212600000333",
            phoneVerified: true,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: false,
            lastLoginAtIso: "2026-11-15T12:00:00.000Z",
            createdAtIso: "2026-11-15T12:00:00.000Z",
          },
        }),
      });
    });
    await page.route("**/v1/auth/revoke-sessions", (route) => {
      sessionsRevoked = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ revoked: true, token: "revoked-all-fresh-jwt" }),
      });
    });
    await page.route("**/v1/auth/logout", (route) => {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ revoked: true }),
      });
    });

    await page.goto("/portal");
    await expect(
      page.getByRole("heading", { name: /Account Profile & Security Settings/i }),
    ).toBeVisible();
    await page.getByLabel("Current password").fill("OldPassword!123");
    await page.getByLabel("New password (min 8 chars)").fill("NewStrongPassword!456");
    await page.getByRole("button", { name: /Update Password/i }).click();
    await expect.poll(() => passwordChanged).toBe(true);

    await page.getByRole("button", { name: /Revoke Other Sessions/i }).click();
    await expect.poll(() => sessionsRevoked).toBe(true);

    await page.getByRole("button", { name: /Sign Out This Device/i }).click();
    await expect.poll(() => logoutCalled).toBe(true);
  });

  test("master admin filters staff/facilities, provisions staff account, triages disputes & inspects audit diffs on /admin", async ({
    page,
  }) => {
    await seedSession(page, {
      id: "99999999-1111-4111-8111-999999999999",
      role: "OPS_ADMIN",
      fullName: "Tariq Alami",
      email: "admin@medisync.ma",
      facilityId: null,
      accountStatus: "ACTIVE",
      credentialVerified: true,
    });
    await mockCommonMoroccoNetwork(page);

    let provisionedCalled = false;
    let disputeStatus: "OPEN" | "UNDER_REVIEW" | "RESOLVED" = "OPEN";

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "99999999-1111-4111-8111-999999999999",
            email: "admin@medisync.ma",
            fullName: "Tariq Alami",
            role: "OPS_ADMIN",
            countryCode: "MA",
            facilityId: null,
            avatarUrl: null,
            emailVerified: true,
            phone: null,
            phoneVerified: false,
            authProvider: "LOCAL",
            accountStatus: "ACTIVE",
            credentialVerified: true,
            lastLoginAtIso: "2026-11-15T12:00:00.000Z",
            createdAtIso: "2026-11-15T12:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/admin/overview*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overview: {
            countryCode: "MA",
            totalUsers: 2,
            totalFacilities: 1,
            pendingVerificationFacilities: 0,
            activeDispatches: 0,
            activeAppointments: 0,
            openPrescriptions: 0,
            pendingLabOrders: 0,
            openDisputes: 1,
            recentAuditLogs: [],
          },
        }),
      }),
    );
    await page.route("**/v1/admin/users*", async (route) => {
      if (route.request().method() === "POST") {
        provisionedCalled = true;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "12345678-1111-4111-8111-123456789012",
              email: "new.doc@medisync.ma",
              fullName: "Dr. Karim Provisioned",
              role: "DOCTOR",
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              avatarUrl: null,
              emailVerified: false,
              phone: null,
              phoneVerified: false,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: null,
              createdAtIso: "2026-11-16T12:00:00.000Z",
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              id: MOCK_DOCTOR_ID,
              email: "dr.berrada@medisync.ma",
              fullName: "Dr. Youssef Berrada",
              role: "DOCTOR",
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              avatarUrl: null,
              emailVerified: true,
              phone: null,
              phoneVerified: false,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: "2026-11-15T12:00:00.000Z",
              createdAtIso: "2026-11-15T12:00:00.000Z",
            },
          ],
        }),
      });
    });
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dispatches: [] }) }),
    );
    await page.route("**/v1/disputes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          disputes: [
            {
              id: "eeeeeeee-1111-4111-8111-111111111111",
              countryCode: "MA",
              reporterUserId: MOCK_PATIENT_ID,
              reporterName: "Salma El Fassi",
              reporterRole: "PATIENT",
              category: "DISPATCH_DELAY",
              subject: "Late pickup in Anfa",
              description: "Ambulance arrived 25 minutes late.",
              targetResourceId: null,
              status: disputeStatus,
              resolutionNote: null,
              resolvedByUserId: null,
              createdAtIso: "2026-11-16T10:00:00.000Z",
              updatedAtIso: "2026-11-16T10:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/admin/disputes/*", async (route) => {
      disputeStatus = "UNDER_REVIEW";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispute: {
            id: "eeeeeeee-1111-4111-8111-111111111111",
            countryCode: "MA",
            reporterUserId: MOCK_PATIENT_ID,
            reporterName: "Salma El Fassi",
            reporterRole: "PATIENT",
            category: "DISPATCH_DELAY",
            subject: "Late pickup in Anfa",
            description: "Ambulance arrived 25 minutes late.",
            targetResourceId: null,
            status: "UNDER_REVIEW",
            resolutionNote: "Marked under review by command desk.",
            resolvedByUserId: "99999999-1111-4111-8111-999999999999",
            createdAtIso: "2026-11-16T10:00:00.000Z",
            updatedAtIso: "2026-11-16T10:05:00.000Z",
          },
        }),
      });
    });
    await page.route("**/v1/admin/audit-events*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          logs: [
            {
              eventId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
              countryCode: "MA",
              actorId: "99999999-1111-4111-8111-999999999999",
              actorRole: "OPS_ADMIN",
              action: "USER_ROLE_UPDATED",
              resourceType: "user",
              resourceId: MOCK_DOCTOR_ID,
              metadata: { previousRole: "CLINIC_STAFF", nextRole: "DOCTOR" },
              occurredAtIso: "2026-11-16T10:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/admin/facility-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/user-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }),
    );
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ appointments: [] }) }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prescriptions: [] }) }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );

    await page.goto("/admin");
    await expect(page.getByLabel("Jurisdiction scope")).toBeVisible();

    await page.getByRole("tab", { name: /Staff & Users/i }).click();
    await expect(page.getByLabel("Search staff and users")).toBeVisible();
    await page.getByRole("button", { name: /Provision Staff Account/i }).click();
    const provisionDialog = page.getByRole("dialog", {
      name: /Provision Staff or Admin Account/i,
    });
    await provisionDialog.getByPlaceholder(/Dr\. Karim Benjelloun/i).fill("Dr. Karim Provisioned");
    await provisionDialog.getByPlaceholder(/karim\.clinic@medisync\.ma/i).fill("new.doc@medisync.ma");
    await provisionDialog.getByPlaceholder(/Min 8 characters/i).fill("StrongPass!2026");
    await provisionDialog.getByRole("button", { name: /^Provision Account$/i }).click();
    await expect.poll(() => provisionedCalled).toBe(true);

    await page.getByRole("tab", { name: /Disputes/i }).click();
    await page.getByRole("button", { name: /^Mark Under Review$/i }).click();
    await expect.poll(() => disputeStatus).toBe("UNDER_REVIEW");

    await page.getByRole("tab", { name: /Activity Log/i }).click();
    await expect(page.getByText(/nextRole=DOCTOR/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeEnabled();
  });

  test("doctor and patient use /consultation/[id] live telehealth video room, write diagnosis & QR E-Rx, and block outsiders", async ({
    page,
  }) => {
    const todayDate = new Date().toISOString().slice(0, 10);
    const savedNotes: Array<{
      id: string;
      countryCode: string;
      patientUserId: string;
      patientName: string;
      doctorUserId: string;
      doctorName: string;
      appointmentId: string;
      facilityId: string;
      icd10Codes: string[];
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
      vitals: null;
      createdAtIso: string;
    }> = [];
    const savedRx: Array<{
      id: string;
      countryCode: string;
      patientUserId: string;
      patientName: string;
      doctorUserId: string;
      doctorName: string;
      facilityId: string;
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        durationDays: number;
      }>;
      notes: null;
      qrToken: string;
      qrSignature: string;
      status: "ISSUED";
      dispensedByUserId: null;
      pharmacyFacilityId: null;
      dispensedAtIso: null;
      dispensingNote: null;
      issuedAtIso: string;
    }> = [];
    const emittedSignals: string[] = [];

    const mockAppointment = {
      id: MOCK_APPT_ID,
      countryCode: "MA",
      scheduleId: MOCK_SCHEDULE_ID,
      facilityId: MOCK_FACILITY_ID,
      facilityName: "CHU Ibn Rochd",
      doctorUserId: MOCK_DOCTOR_ID,
      doctorName: "Dr. Youssef Berrada",
      doctorAvatarUrl: null,
      specialty: "Cardiology",
      patientUserId: MOCK_PATIENT_ID,
      patientName: "Salma El Fassi",
      patientPhone: "+212600000333",
      bookedByUserId: MOCK_PATIENT_ID,
      visitMode: "TELEHEALTH" as const,
      slotStartIso: `${todayDate}T10:00:00.000Z`,
      slotEndIso: `${todayDate}T10:30:00.000Z`,
      status: "CONFIRMED" as const,
      reason: "Palpitations follow-up video check",
      triageNote: null,
      createdAtIso: "2026-11-16T09:00:00.000Z",
      updatedAtIso: "2026-11-16T09:00:00.000Z",
    };

    let activeRole: "DOCTOR" | "PATIENT" | "OUTSIDER" = "DOCTOR";

    await seedSession(page, {
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Youssef Berrada",
      email: "dr.berrada@medisync.ma",
    });
    await mockCommonMoroccoNetwork(page);

    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ appointments: [mockAppointment] }),
      }),
    );
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schedules: [] }),
      }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labOrders: [] }),
      }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mediaObjects: [] }),
      }),
    );
    await page.route("**/v1/clinical/patients/*/profile", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            userId: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            countryCode: "MA",
            dateOfBirth: "1994-05-12",
            biologicalSex: "FEMALE",
            bloodType: "O+",
            nationalHealthId: "MA-CNOPS-9981",
            emergencyContactName: "Nadia El Fassi",
            emergencyContactPhone: "+212600000888",
            heightCm: 165,
            weightKg: 60,
            allergies: [
              {
                allergen: "Penicillin",
                reaction: "Hives",
                severity: "SEVERE",
              },
            ],
            chronicConditions: ["Hypertension"],
            currentMedications: ["Amlodipine 5mg"],
            primaryDoctorUserId: MOCK_DOCTOR_ID,
            preferredFacilityId: MOCK_FACILITY_ID,
            dataSharingConsent: true,
            telehealthConsent: true,
            updatedAtIso: "2026-11-16T09:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/clinical/visit-notes*", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          assessment: string;
          plan: string;
          subjective: string;
          objective: string;
          icd10Codes?: string[];
        };
        const created = {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-111111111111",
          countryCode: "MA",
          patientUserId: MOCK_PATIENT_ID,
          patientName: "Salma El Fassi",
          doctorUserId: MOCK_DOCTOR_ID,
          doctorName: "Dr. Youssef Berrada",
          appointmentId: MOCK_APPT_ID,
          facilityId: MOCK_FACILITY_ID,
          icd10Codes: body.icd10Codes ?? ["I10"],
          subjective: body.subjective,
          objective: body.objective,
          assessment: body.assessment,
          plan: body.plan,
          vitals: null,
          createdAtIso: new Date().toISOString(),
        };
        savedNotes.push(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ visitNote: created }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: savedNotes }),
      });
    });
    await page.route("**/v1/clinical/prescriptions*", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          medications: Array<{
            name: string;
            dosage: string;
            frequency: string;
            durationDays: number;
          }>;
        };
        const created = {
          id: "cccccccc-cccc-4ccc-8ccc-222222222222",
          countryCode: "MA",
          patientUserId: MOCK_PATIENT_ID,
          patientName: "Salma El Fassi",
          doctorUserId: MOCK_DOCTOR_ID,
          doctorName: "Dr. Youssef Berrada",
          facilityId: MOCK_FACILITY_ID,
          medications: body.medications,
          notes: null,
          qrToken: "medisync-rx-live-telehealth-token-1234567890",
          qrSignature: "sig-telehealth-demo",
          status: "ISSUED" as const,
          dispensedByUserId: null,
          pharmacyFacilityId: null,
          dispensedAtIso: null,
          dispensingNote: null,
          issuedAtIso: new Date().toISOString(),
        };
        savedRx.push(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ prescription: created }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: savedRx }),
      });
    });
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/presence`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participant: {
            userId: activeRole === "DOCTOR" ? MOCK_DOCTOR_ID : MOCK_PATIENT_ID,
            role: activeRole === "DOCTOR" ? "DOCTOR" : "PATIENT",
            fullName:
              activeRole === "DOCTOR" ? "Dr. Youssef Berrada" : "Salma El Fassi",
            joined: true,
            audioEnabled: false,
            videoEnabled: false,
            updatedAtIso: new Date().toISOString(),
          },
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/signal`, async (route) => {
      const body = route.request().postDataJSON() as { kind: string };
      emittedSignals.push(body.kind);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          signal: {
            seq: emittedSignals.length,
            appointmentId: MOCK_APPT_ID,
            senderUserId:
              activeRole === "DOCTOR" ? MOCK_DOCTOR_ID : MOCK_PATIENT_ID,
            senderRole: activeRole === "DOCTOR" ? "DOCTOR" : "PATIENT",
            senderName:
              activeRole === "DOCTOR" ? "Dr. Youssef Berrada" : "Salma El Fassi",
            kind: body.kind,
            payload: {},
            sentAtIso: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/stream*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": ping\n\n",
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}*`, (route) => {
      if (activeRole === "OUTSIDER") {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "ONLY_APPOINTMENT_PARTICIPANTS" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointment: mockAppointment,
          selfRole: activeRole,
          participants: [],
          recentSignals: [],
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        }),
      });
    });

    // 1. Doctor launches video consultation straight from /clinical agenda
    await page.goto("/clinical");
    const startVideoLink = page.getByRole("link", { name: /Start Video Consult/i });
    await expect(startVideoLink).toBeVisible();
    await startVideoLink.click();

    await expect(page).toHaveURL(new RegExp(`/consultation/${MOCK_APPT_ID}`));
    await expect(page.getByText(/WebRTC DTLS-SRTP/i)).toBeVisible();
    await expect(page.getByText(/Penicillin/i)).toBeVisible();

    await page
      .getByPlaceholder(/Reported symptoms/i)
      .fill("Occasional palpitations on exertion");
    await page
      .getByPlaceholder(/Visual breathing/i)
      .fill("Calm alert speech, home BP 128/80");
    await page
      .getByPlaceholder(/Primary clinical impression/i)
      .fill("Benign palpitations under monitoring");
    await page
      .getByPlaceholder(/Therapy instructions/i)
      .fill("Hydration and avoid caffeine for 2 weeks");
    await page.getByRole("button", { name: /Save & Share Diagnosis Live/i }).click();
    await expect(
      page.getByText(/Clinical diagnosis saved and pushed live/i),
    ).toBeVisible();

    await page.getByPlaceholder(/Amoxicillin 500mg/i).fill("Bisoprolol 2.5mg");
    await page.getByPlaceholder(/1 capsule/i).fill("1 tablet");
    await page.getByPlaceholder(/Every 8 hours/i).fill("Every morning");
    await page.getByRole("button", { name: /Send QR E-Prescription/i }).click();
    await expect(page.getByText(/QR E-Prescription issued/i)).toBeVisible();
    expect(emittedSignals).toContain("clinical-updated");

    // 2. Patient opens /consultation/[id] and sees live shared diagnosis & QR prescription
    activeRole = "PATIENT";
    await page.evaluate(
      ({ patId }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-patient-jwt",
            user: {
              id: patId,
              email: "salma@medisync.ma",
              fullName: "Salma El Fassi",
              role: "PATIENT",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000333",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: "2026-11-16T09:00:00.000Z",
              createdAtIso: "2026-11-16T09:00:00.000Z",
            },
          }),
        );
      },
      { patId: MOCK_PATIENT_ID },
    );
    await page.goto(`/consultation/${MOCK_APPT_ID}`);
    await expect(page.getByText(/Benign palpitations under monitoring/i)).toBeVisible();
    await expect(page.getByText(/Bisoprolol 2\.5mg/i)).toBeVisible();

    // 3. Unauthorized caller receives strict access barrier
    activeRole = "OUTSIDER";
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Private Consultation Room Restricted/i }),
    ).toBeVisible();
  });

  test("unauthenticated /profile shows sign-in gate while authenticated PATIENT & DOCTOR manage profile, role panel & sign out", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await mockCommonMoroccoNetwork(page);

    let protectedMeCalls = 0;
    let activeUser = {
      id: MOCK_PATIENT_ID,
      email: "salma@medisync.ma",
      fullName: "Salma El Fassi",
      role: "PATIENT",
      countryCode: "MA",
      facilityId: null as string | null,
      avatarUrl: null as string | null,
      emailVerified: true,
      phone: "+212600000333",
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      lastLoginAtIso: "2026-11-16T09:00:00.000Z",
      createdAtIso: "2026-11-16T09:00:00.000Z",
    };
    let profileUpdated = false;
    let logoutCalled = false;

    await page.route("**/v1/auth/me", (route) => {
      protectedMeCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: activeUser }),
      });
    });

    await page.route("**/v1/users/me/media", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );

    await page.route("**/v1/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          facilities: [
            {
              id: MOCK_FACILITY_ID,
              ownerUserId: MOCK_DOCTOR_ID,
              countryCode: "MA",
              kind: "CLINIC",
              name: "Clinique Atlas",
              licenseNumber: "MA-CLN-1001",
              address: "Anfa, Casablanca",
              lat: 33.589,
              lng: -7.64,
              verificationStatus: "VERIFIED",
              open24Hours: false,
              emergencyPhone: "+212522000101",
              photoUrl: null,
              createdAtIso: "2026-11-10T10:00:00.000Z",
            },
          ],
        }),
      }),
    );

    await page.route("**/v1/auth/profile", async (route) => {
      const patch = route.request().postDataJSON() as { fullName?: string };
      profileUpdated = true;
      if (patch.fullName) {
        activeUser = { ...activeUser, fullName: patch.fullName };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: activeUser }),
      });
    });

    await page.route("**/v1/auth/logout", (route) => {
      logoutCalled = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ revoked: true }),
      });
    });

    // 1. Unauthenticated guest sees clean Access Gate and triggers zero protected calls
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: /Sign in to open your MediSync profile/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Sign In or Create Account/i }),
    ).toHaveAttribute("href", "/portal");
    expect(protectedMeCalls).toBe(0);

    // 2. Authenticated PATIENT sees Care Workspace shortcuts & edits profile
    await page.evaluate(
      ({ patId }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-patient-jwt",
            user: {
              id: patId,
              email: "salma@medisync.ma",
              fullName: "Salma El Fassi",
              role: "PATIENT",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000333",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: "2026-11-16T09:00:00.000Z",
              createdAtIso: "2026-11-16T09:00:00.000Z",
            },
          }),
        );
      },
      { patId: MOCK_PATIENT_ID },
    );
    await page.reload();
    await expect(page.getByRole("heading", { name: /Salma El Fassi/i })).toBeVisible();
    await expect(page.getByText(/Your Care Workspace/i)).toBeVisible();
    await expect(page.getByText(/Emergency Profile & Allergies/i)).toBeVisible();
    await expect(page.locator("#user-cred-category")).toHaveCount(0);

    await page.getByLabel("Full Name").fill("Salma El Fassi Updated");
    await page.getByRole("button", { name: /Save Profile/i }).click();
    await expect.poll(() => profileUpdated).toBe(true);
    await expect(
      page.getByRole("heading", { name: /Salma El Fassi Updated/i }),
    ).toBeVisible();

    // Verify zero horizontal overflow on mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(mobileOverflow).toBe(false);
    await page.setViewportSize({ width: 1280, height: 820 });

    // 3. Authenticated DOCTOR sees Credentials & Verification panel and signs out cleanly
    activeUser = {
      ...activeUser,
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Karim Mansour",
      email: "doctor.verified@medisync.ma",
      facilityId: MOCK_FACILITY_ID,
    };
    await page.evaluate(
      ({ docId, facId }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-doctor-jwt",
            user: {
              id: docId,
              email: "doctor.verified@medisync.ma",
              fullName: "Dr. Karim Mansour",
              role: "DOCTOR",
              countryCode: "MA",
              facilityId: facId,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000111",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: "2026-11-16T09:00:00.000Z",
              createdAtIso: "2026-11-16T09:00:00.000Z",
            },
          }),
        );
      },
      { docId: MOCK_DOCTOR_ID, facId: MOCK_FACILITY_ID },
    );
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /Dr\. Karim Mansour/i })).toBeVisible();
    await expect(page.locator("#user-cred-category")).toBeVisible();
    await expect(page.getByText(/Your Care Workspace/i)).toHaveCount(0);

    await page.getByRole("button", { name: /Sign Out This Device/i }).click();
    await expect.poll(() => logoutCalled).toBe(true);
    await expect(
      page.getByRole("heading", { name: /Sign in to open your MediSync profile/i }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("every role interface enforces strict separation across /portal, /pro, /clinical, /lab, /pharmacy, /hospital, /booking, /patient, /map & /admin", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    let expectingIntentional403 = false;
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const txt = msg.text();
        if (expectingIntentional403 && txt.includes("403 (Forbidden)")) {
          return;
        }
        consoleErrors.push(txt);
      }
    });

    await mockCommonMoroccoNetwork(page);

    let unauthorizedClinicalFetches = 0;
    let expectClinicalAllowed = true;
    await page.route("**/v1/clinical/visit-notes*", (route) => {
      if (!expectClinicalAllowed) unauthorizedClinicalFetches += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: [] }),
      });
    });
    await page.route("**/v1/clinical/prescriptions*", (route) => {
      if (!expectClinicalAllowed) unauthorizedClinicalFetches += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [] }),
      });
    });
    await page.route("**/v1/clinical/lab-orders*", (route) => {
      if (!expectClinicalAllowed) unauthorizedClinicalFetches += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labOrders: [] }),
      });
    });
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mediaObjects: [] }),
      }),
    );
    await page.route("**/v1/clinical/patients/*/profile", (route) => {
      if (!expectClinicalAllowed) unauthorizedClinicalFetches += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: null }),
      });
    });
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ appointments: [] }),
      }),
    );
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schedules: [] }),
      }),
    );
    await page.route("**/v1/pharmacy/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ orders: [] }),
      }),
    );
    await page.route("**/v1/directory/demo-personas*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ personas: [] }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [] }),
      }),
    );
    await page.route("**/v1/facilities/*/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/booking/profiles*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: [] }),
      }),
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, facilities: [] }),
      }),
    );

    let currentSessionUser = {
      id: "66666666-1111-4111-8111-666666666666",
      email: "pending.pharm@medisync.ma",
      fullName: "Nabil El Fassi",
      role: "PHARMACIST",
      countryCode: "MA",
      facilityId: MOCK_PHARMACY_ID as string | null,
      avatarUrl: null as string | null,
      emailVerified: true,
      phone: "+212600000444",
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "PENDING_APPROVAL" as "ACTIVE" | "PENDING_APPROVAL",
      credentialVerified: false,
      lastLoginAtIso: "2026-11-16T09:00:00.000Z",
      createdAtIso: "2026-11-16T09:00:00.000Z",
    };

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: currentSessionUser }),
      }),
    );

    const setRoleSession = async (patch: Partial<typeof currentSessionUser>) => {
      currentSessionUser = { ...currentSessionUser, ...patch };
      await page.evaluate((u) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-role-jwt", user: u }),
        );
      }, currentSessionUser);
    };

    // 1. Verified cross-portal rejection on /pro for Patient trying Staff sign-in
    await page.route("**/v1/auth/login", (route) => {
      const body = route.request().postDataJSON() as { portalTrack?: string };
      expect(body.portalTrack).toBe("STAFF");
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "USE_PATIENT_PORTAL" }),
      });
    });
    await page.goto("/pro");
    expectingIntentional403 = true;
    await page.getByLabel(/Work Email or Phone Number/i).fill("salma@medisync.ma");
    await page.getByLabel(/Password/i).fill("PatientPass123!");
    await page.getByRole("button", { name: /Sign In as Staff Member/i }).click();
    await expect(
      page.getByText(/Patient and caregiver accounts must sign in via Patient Access/i),
    ).toBeVisible();
    expectingIntentional403 = false;

    // 2. PENDING_APPROVAL PHARMACIST on /pharmacy sees Verification Gate & NO consumer cart
    await setRoleSession({
      role: "PHARMACIST",
      fullName: "Nabil Pending Pharm",
      accountStatus: "PENDING_APPROVAL",
      credentialVerified: false,
      facilityId: null,
    });
    await page.goto("/pharmacy");
    await expect(
      page.getByText(/Administration Verification Required/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Upload Papers & Check Status/i }),
    ).toHaveAttribute("href", "/pro");
    await expect(page.getByText(/Shopping Cart & Checkout/i)).toHaveCount(0);
    await expect(page.getByText(/Storefront & Rx Checkout/i)).toHaveCount(0);

    // 3. PENDING_APPROVAL DOCTOR cannot bypass ConsumerWorkspaceGuard on /booking, /patient, or /map
    await setRoleSession({
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Pending Gate",
      accountStatus: "PENDING_APPROVAL",
      credentialVerified: false,
    });
    await page.goto("/booking");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /View Onboarding on MediSync Pro/i }),
    ).toHaveAttribute("href", "/pro");
    await page.goto("/patient");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await page.goto("/map");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();

    // 4. Verified CLINIC_STAFF is strictly scoped to /hospital (isolated from Doctor /clinical and /admin)
    expectClinicalAllowed = false;
    unauthorizedClinicalFetches = 0;
    await setRoleSession({
      id: "88888888-1111-4111-8111-888888888888",
      role: "CLINIC_STAFF",
      fullName: "Kenza Reception",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      facilityId: MOCK_FACILITY_ID,
    });
    await page.goto("/clinical");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    expect(unauthorizedClinicalFetches).toBe(0);
    await page.goto("/admin");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await expect(page.getByText(/Restricted to/i)).toBeVisible();

    // 5. Verified PHARMACIST visiting /clinical triggers ZERO clinical calls & sees Role Separation Active
    await setRoleSession({
      id: "77777777-0000-4000-8000-777777777777",
      role: "PHARMACIST",
      fullName: "Dr. Karim Tazi",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      facilityId: MOCK_PHARMACY_ID,
    });
    expectClinicalAllowed = false;
    unauthorizedClinicalFetches = 0;
    await page.goto("/clinical");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    expect(unauthorizedClinicalFetches).toBe(0);

    // 6. Verified LAB_TECH on /lab sees dedicated LIMS workbench and is isolated from /pharmacy
    expectClinicalAllowed = true;
    await setRoleSession({
      id: "66666666-2222-4222-8222-666666666666",
      role: "LAB_TECH",
      fullName: "Youssef Lab",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      facilityId: MOCK_LAB_ID,
    });
    await page.goto("/lab");
    await expect(
      page.getByRole("heading", { name: /Diagnostic Laboratory Workbench/i }),
    ).toBeVisible();
    await page.goto("/pharmacy");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();

    // 7. Verified PATIENT accessing /clinical or /hospital gets clean Role Separation Active & 0 clinical fetches
    await setRoleSession({
      id: MOCK_PATIENT_ID,
      role: "PATIENT",
      fullName: "Salma El Fassi",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      facilityId: null,
    });
    expectClinicalAllowed = false;
    unauthorizedClinicalFetches = 0;
    await page.goto("/clinical");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    expect(unauthorizedClinicalFetches).toBe(0);
    await page.goto("/hospital");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("upgraded dashboards: admin file validation & live tracker, driver 3-tabs, nurse clinical care, doctor pause/delete schedule, and pharmacist sales/edit/papers", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await mockCommonMoroccoNetwork(page);

    const NURSE_ID = "88888888-2222-4222-8222-888888888888";
    const DRIVER_ID = "77777777-3333-4333-8333-777777777777";
    const PHARM_ID = "66666666-4444-4444-8444-666666666666";
    const DOC_MEDIA_ID = "12121212-1212-4212-8212-121212121212";
    const PROD_ID = "34343434-3434-4434-8434-343434343434";

    let reviewedDoc = false;
    let schedulePaused = false;
    let scheduleDeleted = false;
    let productPatchedName = "";

    let sessionUser = {
      id: "99999999-1111-4111-8111-999999999999",
      email: "admin@medisync.ma",
      fullName: "Tariq Master Admin",
      role: "OPS_ADMIN",
      countryCode: "MA",
      facilityId: null as string | null,
      avatarUrl: null,
      emailVerified: true,
      phone: "+212600000100",
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      lastLoginAtIso: "2026-11-18T09:00:00.000Z",
      createdAtIso: "2026-11-18T09:00:00.000Z",
    };

    const setRole = async (patch: Partial<typeof sessionUser>) => {
      sessionUser = { ...sessionUser, ...patch };
      await page.addInitScript((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, sessionUser);
      await page.evaluate((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, sessionUser);
    };

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: sessionUser }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/facilities/*/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/admin/overview*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overview: {
            countryCode: "MA",
            totalUsers: 4,
            pendingVerificationUsers: 1,
            totalNurses: 1,
            totalFacilities: 2,
            pendingVerificationFacilities: 0,
            pendingReviewDocuments: reviewedDoc ? 0 : 1,
            activeDispatches: 1,
            completedDispatches: 2,
            activeAppointments: 1,
            openPrescriptions: 1,
            pendingLabOrders: 0,
            totalPharmacyOrders: 1,
            pharmacyRevenueMinor: 14500,
            openDisputes: 0,
            recentAuditLogs: [],
          },
        }),
      }),
    );
    await page.route("**/v1/admin/users*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              ...sessionUser,
              id: NURSE_ID,
              email: "nurse.ma@medisync.ma",
              fullName: "Nora Benali",
              role: "NURSE",
              accountStatus: "PENDING_APPROVAL",
              credentialVerified: false,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/admin/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/admin/audit-events*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [] }) }),
    );
    await page.route("**/v1/admin/facility-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/user-media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documents: [
            {
              id: DOC_MEDIA_ID,
              countryCode: "MA",
              userId: NURSE_ID,
              category: "PRACTITIONER_LICENSE",
              objectKey: "users/nurse-license.pdf",
              fileName: "nursing-license-ma.pdf",
              mimeType: "application/pdf",
              sizeBytes: 120400,
              confirmedSizeBytes: 120400,
              uploadStatus: "UPLOADED",
              reviewStatus: reviewedDoc ? "APPROVED" : "PENDING_REVIEW",
              reviewerNote: null,
              reviewedByUserId: reviewedDoc ? sessionUser.id : null,
              reviewedAtIso: reviewedDoc ? "2026-11-18T10:00:00.000Z" : null,
              downloadUrl: "http://127.0.0.1:9010/medisync-clinical-media/nurse.pdf",
              createdAtIso: "2026-11-18T08:00:00.000Z",
              userName: "Nora Benali",
              userEmail: "nurse.ma@medisync.ma",
              userRole: "NURSE",
              accountStatus: "PENDING_APPROVAL",
              credentialVerified: false,
            },
          ],
        }),
      }),
    );
    await page.route(
      `**/v1/admin/user-media/${DOC_MEDIA_ID}/review`,
      async (route) => {
        reviewedDoc = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            document: {
              id: DOC_MEDIA_ID,
              countryCode: "MA",
              userId: NURSE_ID,
              category: "PRACTITIONER_LICENSE",
              objectKey: "users/nurse-license.pdf",
              fileName: "nursing-license-ma.pdf",
              mimeType: "application/pdf",
              sizeBytes: 120400,
              confirmedSizeBytes: 120400,
              uploadStatus: "UPLOADED",
              reviewStatus: "APPROVED",
              reviewerNote: "Verified",
              reviewedByUserId: sessionUser.id,
              reviewedAtIso: "2026-11-18T10:00:00.000Z",
              downloadUrl: "http://127.0.0.1:9010/medisync-clinical-media/nurse.pdf",
              createdAtIso: "2026-11-18T08:00:00.000Z",
            },
          }),
        });
      },
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, facilities: [] }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, drivers: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/dispatch/stream*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: "2026-11-18T10:00:00.000Z" })}\n\n`,
      }),
    );
    await page.route("**/v1/clinical/patients/*/profile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: null }),
      }),
    );
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispatches: [
            {
              id: "51515151-5151-4551-8551-515151515151",
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              driverUserId: DRIVER_ID,
              targetFacilityId: MOCK_PHARMACY_ID,
              urgency: "ROUTINE",
              status: "REQUESTED",
              pickupAddress: "Pharmacie Anfa -> 240 Bd d'Anfa",
              pickupLat: 33.591,
              pickupLng: -7.638,
              notes: "Pharmacy courier order REC-MA-8812 · 1 item",
              createdAtIso: "2026-11-18T10:00:00.000Z",
              updatedAtIso: "2026-11-18T10:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          orders: [
            {
              id: MOCK_ORDER_ID,
              countryCode: "MA",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Anfa",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              prescriptionId: null,
              fulfillmentMode: "COURIER_DELIVERY",
              status: "PAID",
              paymentMethod: "CARD_SIMULATED",
              paymentReference: null,
              currencyCode: "MAD",
              subtotalMinor: 12000,
              deliveryFeeMinor: 2500,
              totalMinor: 14500,
              receiptNumber: "REC-MA-8812",
              deliveryAddress: "240 Bd d'Anfa",
              dispatchRequestId: "51515151-5151-4551-8551-515151515151",
              notes: null,
              items: [
                {
                  id: "41414141-4141-4441-8441-414141414141",
                  productId: PROD_ID,
                  sku: "PAR-500",
                  productName: "Paracetamol Doliprane 500mg",
                  requiresPrescription: false,
                  unitPriceMinor: 6000,
                  quantity: 2,
                  lineTotalMinor: 12000,
                },
              ],
              paidAtIso: "2026-11-18T09:55:00.000Z",
              createdAtIso: "2026-11-18T09:50:00.000Z",
              updatedAtIso: "2026-11-18T09:55:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route(`**/v1/pharmacy/products/${PROD_ID}`, async (route) => {
      const payload = route.request().postDataJSON() as { name?: string };
      productPatchedName = payload.name ?? "Updated SKU";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          product: {
            id: PROD_ID,
            countryCode: "MA",
            facilityId: MOCK_PHARMACY_ID,
            facilityName: "Pharmacie Anfa",
            sku: "PAR-500",
            name: productPatchedName,
            genericName: "Paracetamol",
            category: "OTC_MEDICATION",
            dosageForm: "Tablet",
            strength: "500mg",
            requiresPrescription: false,
            priceMinor: 6500,
            currencyCode: "MAD",
            stockQty: 24,
            isActive: false,
            imageUrl: null,
            createdAtIso: "2026-11-18T08:00:00.000Z",
            updatedAtIso: "2026-11-18T10:15:00.000Z",
          },
        }),
      });
    });
    await page.route("**/v1/pharmacy/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          products: [
            {
              id: PROD_ID,
              countryCode: "MA",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Anfa",
              sku: "PAR-500",
              name: productPatchedName || "Paracetamol Doliprane 500mg",
              genericName: "Paracetamol",
              category: "OTC_MEDICATION",
              dosageForm: "Tablet",
              strength: "500mg",
              requiresPrescription: false,
              priceMinor: 6000,
              currencyCode: "MAD",
              stockQty: 24,
              isActive: false,
              imageUrl: null,
              createdAtIso: "2026-11-18T08:00:00.000Z",
              updatedAtIso: "2026-11-18T08:00:00.000Z",
            },
          ],
          deliveryFeeMinor: 2500,
        }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prescriptions: [] }) }),
    );
    await page.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ visitNotes: [] }) }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mediaObjects: [] }) }),
    );
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ appointments: [] }) }),
    );
    await page.route(`**/v1/booking/schedules/${MOCK_SCHEDULE_ID}`, async (route) => {
      if (route.request().method() === "PATCH") {
        schedulePaused = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule: {
              id: MOCK_SCHEDULE_ID,
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              doctorAvatarUrl: null,
              specialty: "Cardiology",
              dayOfWeek: 1,
              startTimeUtc: "09:00",
              endTimeUtc: "12:00",
              slotDurationMinutes: 30,
              visitMode: "IN_PERSON",
              isActive: false,
              createdAtIso: "2026-11-18T08:00:00.000Z",
            },
          }),
        });
      }
      if (route.request().method() === "DELETE") {
        scheduleDeleted = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true, scheduleId: MOCK_SCHEDULE_ID }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schedules: scheduleDeleted
            ? []
            : [
                {
                  id: MOCK_SCHEDULE_ID,
                  countryCode: "MA",
                  facilityId: MOCK_FACILITY_ID,
                  facilityName: "CHU Ibn Rochd",
                  doctorUserId: MOCK_DOCTOR_ID,
                  doctorName: "Dr. Youssef Berrada",
                  doctorAvatarUrl: null,
                  specialty: "Cardiology",
                  dayOfWeek: 1,
                  startTimeUtc: "09:00",
                  endTimeUtc: "12:00",
                  slotDurationMinutes: 30,
                  visitMode: "IN_PERSON",
                  isActive: !schedulePaused,
                  createdAtIso: "2026-11-18T08:00:00.000Z",
                },
              ],
        }),
      }),
    );

    // 1. Admin validates uploaded files + monitors live sales/operations tracker
    await page.goto("/admin");
    await setRole({ role: "OPS_ADMIN", fullName: "Tariq Master Admin" });
    await page.reload();
    await page.getByRole("tab", { name: /Files & Licenses/i }).click();
    await expect(page.getByText("nursing-license-ma.pdf")).toBeVisible();
    await page.getByRole("button", { name: /Validate & Approve/i }).click();
    await expect.poll(() => reviewedDoc).toBe(true);

    await page.getByRole("tab", { name: /Live Tracker/i }).click();
    await expect(page.getByText(/REC-MA-8812/i)).toBeVisible();

    // 2. Driver uses Live Radar filter + Trips & Papers tabs
    await setRole({
      id: DRIVER_ID,
      role: "DRIVER",
      email: "driver.ma@medisync.ma",
      fullName: "Karim Chauffeur",
      facilityId: null,
    });
    await page.goto("/driver");
    await expect(page.getByRole("tab", { name: /Live Radar/i })).toBeVisible();
    await page.getByRole("button", { name: /Pharmacy Courier/i }).click();
    await expect(page.getByText(/Pharmacie Anfa/i).first()).toBeVisible();
    await page.getByRole("tab", { name: /Trips/i }).click();
    await expect(page.getByText(/Shift Performance & Trips/i)).toBeVisible();
    await page.getByRole("tab", { name: /^Papers$/i }).click();
    await expect(page.getByText(/Vehicle & Compliance File/i)).toBeVisible();

    // 3. Doctor pauses & deletes schedule + opens Papers & Licenses
    await setRole({
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      email: "dr.berrada@medisync.ma",
      fullName: "Dr. Youssef Berrada",
      facilityId: MOCK_FACILITY_ID,
    });
    await page.goto("/clinical");
    await page.getByRole("tab", { name: /Clinic Shifts/i }).click();
    await expect(page.getByRole("button", { name: /^Pause$/i })).toBeVisible();
    await page.getByRole("button", { name: /^Pause$/i }).click();
    await expect.poll(() => schedulePaused).toBe(true);
    await page.getByRole("button", { name: /^Delete$/i }).click();
    await expect.poll(() => scheduleDeleted).toBe(true);
    await page.getByRole("tab", { name: /Papers & Licenses/i }).click();
    await expect(page.getByText(/Practitioner Registry & Credentials/i)).toBeVisible();

    // 4. Nurse has dedicated /nurse station & cannot open Doctor /clinical
    await setRole({
      id: NURSE_ID,
      role: "NURSE",
      email: "nurse.ma@medisync.ma",
      fullName: "Nora Benali",
      facilityId: MOCK_FACILITY_ID,
    });
    await page.goto("/clinical");
    await expect(page.getByText(/Role Separation Active/i)).toBeVisible();
    await page.goto("/nurse");
    await page.getByRole("tab", { name: /Vitals & Care Notes/i }).click();
    await expect(page.getByText(/Nursing Care, Vitals & Chart Note/i)).toBeVisible();
    await expect(
      page.getByText(/prescription issuing \(E-Rx\) is reserved for physicians/i),
    ).toBeVisible();

    // 4b. Authenticated /profile renders GDPR/CNDP Privacy Consents & Data Rights card
    await page.route("**/v1/users/me/consents*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consents: [
            {
              id: "12121212-1212-4212-8212-121212121212",
              userId: NURSE_ID,
              consentType: "TERMS_PRIVACY",
              consentVersion: "2026-11",
              granted: true,
              sourcePortal: "STAFF",
              grantedAtIso: "2026-11-18T10:00:00.000Z",
              revokedAtIso: null,
            },
          ],
        }),
      }),
    );
    await page.goto("/profile");
    await expect(page.getByText(/Privacy Consents & Data Rights/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Download My Data/i })).toBeVisible();

    // 5. Pharmacist sees Sales KPI strip, edits catalog SKU (incl. Paused), and views Papers & Permits
    await setRole({
      id: PHARM_ID,
      role: "PHARMACIST",
      email: "pharm.ma@medisync.ma",
      fullName: "Dr. Salima Officine",
      facilityId: MOCK_PHARMACY_ID,
    });
    await page.goto("/pharmacy");
    await page.getByRole("tab", { name: /Orders & Receipts/i }).click();
    await expect(page.getByText(/Settled Sales/i)).toBeVisible();
    await page.getByRole("tab", { name: /Pharmacist Stock Manager/i }).click();
    await expect(page.getByText("Paracetamol Doliprane 500mg")).toBeVisible();
    await page.getByRole("button", { name: /Edit stock and price for Paracetamol Doliprane 500mg/i }).click();
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect.poll(() => productPatchedName).toBe("Paracetamol Doliprane 500mg");
    await page.getByRole("tab", { name: /Papers & Permits/i }).click();
    await expect(page.getByText(/Facility Permits & Compliance Papers/i)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("telehealth room: empty ICD-10 default, localized SOAP templates, EN/FR/AR duration chips, and allergy CDS blocking/override", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const todayDate = new Date().toISOString().slice(0, 10);
    let capturedRxMedName = "";

    await seedSession(page, {
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Youssef Berrada",
      email: "dr.berrada@medisync.ma",
    });
    await mockCommonMoroccoNetwork(page);

    const mockAppointment = {
      id: MOCK_APPT_ID,
      countryCode: "MA",
      scheduleId: MOCK_SCHEDULE_ID,
      facilityId: MOCK_FACILITY_ID,
      facilityName: "CHU Ibn Rochd",
      doctorUserId: MOCK_DOCTOR_ID,
      doctorName: "Dr. Youssef Berrada",
      doctorAvatarUrl: null,
      specialty: "Cardiology",
      patientUserId: MOCK_PATIENT_ID,
      patientName: "Salma El Fassi",
      patientPhone: "+212600000333",
      bookedByUserId: MOCK_PATIENT_ID,
      visitMode: "TELEHEALTH" as const,
      slotStartIso: `${todayDate}T10:00:00.000Z`,
      slotEndIso: `${todayDate}T10:30:00.000Z`,
      status: "CONFIRMED" as const,
      reason: "Respiratory symptoms telehealth triage",
      triageNote: null,
      createdAtIso: "2026-11-16T09:00:00.000Z",
      updatedAtIso: "2026-11-16T09:00:00.000Z",
    };

    await page.route("**/v1/clinical/patients/*/profile", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            userId: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            countryCode: "MA",
            dateOfBirth: "1994-05-12",
            biologicalSex: "FEMALE",
            bloodType: "O+",
            nationalHealthId: "MA-CNOPS-9981",
            emergencyContactName: "Nadia El Fassi",
            emergencyContactPhone: "+212600000888",
            heightCm: 165,
            weightKg: 60,
            allergies: [
              {
                allergen: "Penicillin",
                reaction: "Anaphylaxis / Hives",
                severity: "SEVERE",
              },
            ],
            chronicConditions: [],
            currentMedications: [],
            primaryDoctorUserId: MOCK_DOCTOR_ID,
            preferredFacilityId: MOCK_FACILITY_ID,
            dataSharingConsent: true,
            telehealthConsent: true,
            updatedAtIso: "2026-11-16T09:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: [] }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions*", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          medications: Array<{
            name: string;
            dosage: string;
            frequency: string;
            durationDays: number;
          }>;
        };
        capturedRxMedName = body.medications[0]?.name ?? "";
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            prescription: {
              id: MOCK_RX_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              facilityId: MOCK_FACILITY_ID,
              medications: body.medications,
              notes: null,
              qrToken: "medisync-rx-cds-override-1234567890",
              qrSignature: "sig-cds-demo",
              status: "ISSUED",
              dispensedByUserId: null,
              pharmacyFacilityId: null,
              dispensedAtIso: null,
              dispensingNote: null,
              issuedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [] }),
      });
    });
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/presence`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participant: {
            userId: MOCK_DOCTOR_ID,
            role: "DOCTOR",
            fullName: "Dr. Youssef Berrada",
            joined: true,
            audioEnabled: false,
            videoEnabled: false,
            updatedAtIso: new Date().toISOString(),
          },
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/signal`, (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          signal: {
            seq: 1,
            appointmentId: MOCK_APPT_ID,
            senderUserId: MOCK_DOCTOR_ID,
            senderRole: "DOCTOR",
            senderName: "Dr. Youssef Berrada",
            kind: "clinical-updated",
            payload: {},
            sentAtIso: new Date().toISOString(),
          },
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/stream*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": ping\n\n",
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointment: mockAppointment,
          selfRole: "DOCTOR",
          participants: [],
          recentSignals: [],
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        }),
      }),
    );

    const switchLocale = async (target: "English" | "Français" | "العربية") => {
      await page
        .getByRole("button", { name: /Open navigation|Ouvrir le menu|فتح القائمة/i })
        .click();
      const langGroup = page.getByRole("group", {
        name: "Interface language selector",
      });
      await langGroup.getByRole("button", { name: new RegExp(target, "i") }).click();
      await page
        .getByRole("button", { name: /Close menu|Fermer le menu|إغلاق القائمة/i })
        .click();
    };

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/consultation/${MOCK_APPT_ID}`);

    // 1. ICD-10 starts empty (no pre-filled Hypertension "I10")
    const icdInput = page.locator("#telehealth-icd10");
    await expect(icdInput).toHaveValue("");

    // 2. One-tap localized SOAP template fills ICD-10 and all 4 SOAP fields; Clear draft resets them
    await page.getByRole("button", { name: /Acute URI \/ Fever/i }).click();
    await expect(icdInput).toHaveValue("J06.9");
    await expect(page.getByPlaceholder(/Reported symptoms/i)).toHaveValue(/sore throat/i);
    await page.getByRole("button", { name: /Clear draft/i }).click();
    await expect(icdInput).toHaveValue("");
    await expect(page.getByPlaceholder(/Reported symptoms/i)).toHaveValue("");

    // 3. Moroccan formulary preset Augmentin 1g triggers Penicillin cross-reactivity CDS & blocks submit until override
    await page.getByRole("button", { name: "Augmentin 1g", exact: true }).click();
    const allergyAlert = page.locator("main").getByRole("alert");
    await expect(allergyAlert).toBeVisible();
    await expect(allergyAlert).toContainText(/Penicillin/i);
    const issueRxBtn = page.getByRole("button", { name: /Send QR E-Prescription/i });
    await expect(issueRxBtn).toBeDisabled();

    await allergyAlert.getByRole("switch").click();
    await expect(issueRxBtn).toBeEnabled();
    await issueRxBtn.click();
    await expect.poll(() => capturedRxMedName).toMatch(/Augmentin/i);

    // 4. EN duration chips show "7d", FR shows "7j" + French CDS, AR shows "7 أيام" + Arabic CDS
    await expect(page.getByRole("button", { name: "7d", exact: true })).toBeVisible();

    await switchLocale("Français");
    await expect(page.getByRole("button", { name: "7j", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "7d", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Suivi Cardiologie/i })).toBeVisible();
    await page.getByPlaceholder(/Amoxicilline 500mg/i).fill("Amoxicilline 1g");
    await expect(page.locator("main").getByRole("alert")).toContainText(/ALERTE SÉCURITÉ CLINIQUE/i);

    await switchLocale("العربية");
    await expect(page.getByRole("button", { name: "7 أيام", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "30 يوم", exact: true })).toBeVisible();
    await page.getByPlaceholder(/Amoxicillin 500mg/i).fill("أموكسيسيلين 1غ");
    await expect(page.locator("main").getByRole("alert")).toContainText(/تحذير السلامة السريرية/i);

    await switchLocale("English");
    expect(consoleErrors).toEqual([]);
  });

  test("Moroccan compliance & tactile controls: INTL OPS_ADMIN SAMU 141, CNDP 09-08 rights, portal pharmacy framing, pharmacist inline steppers, doctor tariff stepper & calendar switches", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const PROD_ID = "56565656-5656-4565-8565-565656565656";
    const SECOND_PATIENT_ID = "23232323-2323-4232-8232-232323232323";
    const SECOND_APPT_ID = "abababab-abab-4aba-8aba-abababababab";
    const todayDate = new Date().toISOString().slice(0, 10);

    let activeUser = {
      id: "99999999-1111-4111-8111-999999999999",
      email: "admin@medisync.global",
      fullName: "Global Ops Admin",
      role: "OPS_ADMIN",
      countryCode: "INTL",
      facilityId: null as string | null,
      avatarUrl: null as string | null,
      emailVerified: true,
      phone: "+212600000100",
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      lastLoginAtIso: "2026-11-18T09:00:00.000Z",
      createdAtIso: "2026-11-18T09:00:00.000Z",
    };

    const setActiveSession = async (patch: Partial<typeof activeUser>) => {
      activeUser = { ...activeUser, ...patch };
      await page.addInitScript((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, activeUser);
      await page.evaluate((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, activeUser);
    };

    const switchLocale = async (target: "English" | "Français" | "العربية") => {
      await page
        .getByRole("button", { name: /Open navigation|Ouvrir le menu|فتح القائمة/i })
        .click();
      const langGroup = page.getByRole("group", {
        name: "Interface language selector",
      });
      await langGroup.getByRole("button", { name: new RegExp(target, "i") }).click();
      await page
        .getByRole("button", { name: /Close menu|Fermer le menu|إغلاق القائمة/i })
        .click();
    };

    await seedSession(page, {
      id: activeUser.id,
      role: "OPS_ADMIN",
      fullName: activeUser.fullName,
      email: activeUser.email,
      countryCode: "INTL",
      facilityId: null,
    });
    await mockCommonMoroccoNetwork(page);

    let capturedProductPatch: { stockQty?: number; priceMinor?: number } | null = null;
    let capturedFeeMinor: number | null = null;

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: activeUser }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/facilities/*/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/overview*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overview: {
            countryCode: "MA",
            totalUsers: 2,
            totalFacilities: 1,
            pendingVerificationFacilities: 0,
            activeDispatches: 0,
            activeAppointments: 0,
            openPrescriptions: 0,
            pendingLabOrders: 0,
            openDisputes: 0,
            recentAuditLogs: [],
          },
        }),
      }),
    );
    await page.route("**/v1/admin/users*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: [] }) }),
    );
    await page.route("**/v1/admin/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/disputes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ disputes: [] }) }),
    );
    await page.route("**/v1/admin/audit-events*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [] }) }),
    );
    await page.route("**/v1/admin/facility-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/admin/user-media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/dispatch/requests*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dispatches: [] }) }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }),
    );
    await page.route(`**/v1/pharmacy/products/${PROD_ID}`, async (route) => {
      capturedProductPatch = route.request().postDataJSON() as {
        stockQty?: number;
        priceMinor?: number;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          product: {
            id: PROD_ID,
            countryCode: "MA",
            facilityId: MOCK_PHARMACY_ID,
            facilityName: "Pharmacie Al Amal",
            sku: "PAR-500",
            name: "Paracetamol Doliprane 500mg",
            genericName: "Paracetamol",
            category: "OTC_MEDICATION",
            dosageForm: "Tablet",
            strength: "500mg",
            requiresPrescription: false,
            priceMinor: capturedProductPatch.priceMinor ?? 6000,
            currencyCode: "MAD",
            stockQty: capturedProductPatch.stockQty ?? 24,
            isActive: true,
            imageUrl: null,
            createdAtIso: "2026-11-18T08:00:00.000Z",
            updatedAtIso: "2026-11-18T10:15:00.000Z",
          },
        }),
      });
    });
    await page.route("**/v1/pharmacy/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          products: [
            {
              id: PROD_ID,
              countryCode: "MA",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Al Amal",
              sku: "PAR-500",
              name: "Paracetamol Doliprane 500mg",
              genericName: "Paracetamol",
              category: "OTC_MEDICATION",
              dosageForm: "Tablet",
              strength: "500mg",
              requiresPrescription: false,
              priceMinor: 6000,
              currencyCode: "MAD",
              stockQty: 24,
              isActive: true,
              imageUrl: null,
              createdAtIso: "2026-11-18T08:00:00.000Z",
              updatedAtIso: "2026-11-18T08:00:00.000Z",
            },
          ],
          deliveryFeeMinor: 2500,
        }),
      }),
    );
    await page.route("**/v1/clinical/prescriptions*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prescriptions: [] }) }),
    );
    await page.route("**/v1/clinical/visit-notes*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ visitNotes: [] }) }),
    );
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mediaObjects: [] }) }),
    );
    await page.route("**/v1/clinical/patients/*/profile*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: null }) }),
    );
    await page.route("**/v1/booking/profiles*", async (route) => {
      if (route.request().method() === "PUT") {
        const payload = route.request().postDataJSON() as {
          specialty: string;
          licenseNumber: string;
          consultationFeeMinor: number;
        };
        capturedFeeMinor = payload.consultationFeeMinor;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            profile: {
              userId: MOCK_DOCTOR_ID,
              fullName: "Dr. Youssef Berrada",
              countryCode: "MA",
              specialty: payload.specialty,
              licenseNumber: payload.licenseNumber,
              consultationFeeMinor: payload.consultationFeeMinor,
              facilityId: MOCK_FACILITY_ID,
              updatedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profiles: [
            {
              userId: MOCK_DOCTOR_ID,
              fullName: "Dr. Youssef Berrada",
              countryCode: "MA",
              specialty: "Cardiology",
              licenseNumber: "MA-MD-48210",
              consultationFeeMinor: 35000,
              facilityId: MOCK_FACILITY_ID,
              updatedAtIso: "2026-11-18T08:00:00.000Z",
            },
          ],
        }),
      });
    });
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schedules: [
            {
              id: MOCK_SCHEDULE_ID,
              countryCode: "MA",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              dayOfWeek: new Date(`${todayDate}T10:00:00.000Z`).getUTCDay(),
              startTimeUtc: "09:00",
              endTimeUtc: "13:00",
              slotDurationMinutes: 30,
              visitMode: "IN_PERSON",
              isActive: true,
              createdAtIso: "2026-11-14T08:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointments: [
            {
              id: MOCK_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              bookedByUserId: MOCK_PATIENT_ID,
              visitMode: "IN_PERSON",
              slotStartIso: `${todayDate}T09:30:00.000Z`,
              slotEndIso: `${todayDate}T10:00:00.000Z`,
              status: "CONFIRMED",
              reason: "In-person BP check",
              triageNote: null,
              createdAtIso: "2026-11-14T09:00:00.000Z",
              updatedAtIso: "2026-11-14T09:00:00.000Z",
            },
            {
              id: SECOND_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: SECOND_PATIENT_ID,
              patientName: "Karim Mansouri",
              bookedByUserId: SECOND_PATIENT_ID,
              visitMode: "TELEHEALTH",
              slotStartIso: `${todayDate}T11:00:00.000Z`,
              slotEndIso: `${todayDate}T11:30:00.000Z`,
              status: "CONFIRMED",
              reason: "Video ECG review",
              triageNote: null,
              createdAtIso: "2026-11-14T09:00:00.000Z",
              updatedAtIso: "2026-11-14T09:00:00.000Z",
            },
          ],
        }),
      }),
    );

    // 1. OPS_ADMIN (countryCode: INTL) sees SAMU 141 (NOT 112) in AppHeader and ClinicalOsRail
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.locator("header")).toContainText("24/7 Emergency 141");
    await expect(page.locator("header")).not.toContainText("112");
    const navRail = page.getByLabel("Medical Navigation Sidebar");
    await expect(navRail).toContainText("Emergency 141");
    await expect(navRail).not.toContainText("112");

    // 2. ComplianceRightsCard cites Moroccan CNDP Law 09-08 with zero GDPR/RGPD across EN/FR/AR
    await setActiveSession({
      id: MOCK_PATIENT_ID,
      role: "PATIENT",
      fullName: "Salma El Fassi",
      email: "salma@medisync.ma",
      countryCode: "MA",
      facilityId: null,
    });
    await page.goto("/profile");
    await expect(page.getByText(/Moroccan CNDP Law 09-08/i).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/GDPR|RGPD/i);

    await switchLocale("Français");
    await expect(page.getByText(/Loi marocaine CNDP 09-08/i).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/GDPR|RGPD/i);

    await switchLocale("العربية");
    await expect(page.getByText(/القانون المغربي CNDP 09-08/i).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/GDPR|RGPD/i);
    await switchLocale("English");

    // 3. PatientPortalWorkspace uses Law 17-04 duty pharmacy / parapharmacy framing across EN/FR/AR
    await page.goto("/portal");
    await expect(
      page.getByRole("link", { name: /24\/7 Duty Pharmacy & Parapharmacy/i }),
    ).toBeVisible();
    await switchLocale("Français");
    await expect(
      page.getByRole("link", { name: /Pharmacies de Garde & Parapharmacie/i }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Pharmacie en Ligne");
    await switchLocale("العربية");
    await expect(
      page.getByRole("link", { name: /صيدليات الحراسة وشبه الصيدلية/i }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText("الصيدلية الإلكترونية");
    await switchLocale("English");

    // 4. PharmacistInventoryDesk inline edit uses ClinicalStepper (no input[type="number"]) & persists exact values
    await setActiveSession({
      id: "77777777-0000-4000-8000-777777777777",
      role: "PHARMACIST",
      fullName: "Dr. Karim Tazi",
      email: "pharmacist@al-amal.ma",
      countryCode: "MA",
      facilityId: MOCK_PHARMACY_ID,
    });
    await page.goto("/pharmacy");
    await page.getByRole("tab", { name: /Pharmacist Stock Manager/i }).click();
    await page
      .getByRole("button", { name: /Edit stock and price for Paracetamol Doliprane 500mg/i })
      .click();
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
    await page.getByRole("button", { name: /Increase Exact Stock/i }).click();
    const priceInput = page.locator(`#edit-price-${PROD_ID}`);
    await priceInput.fill("65,50");
    await page.getByRole("button", { name: /Increase PPV \(MAD\)/i }).click();
    await expect(priceInput).toHaveValue("70.50");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect.poll(() => capturedProductPatch).toEqual(
      expect.objectContaining({ stockQty: 29, priceMinor: 7050 }),
    );

    // 5. DoctorCalendarAgenda switch filters + ClinicalPapersPanel tariff stepper decimal save
    await setActiveSession({
      id: MOCK_DOCTOR_ID,
      role: "DOCTOR",
      fullName: "Dr. Youssef Berrada",
      email: "dr.berrada@medisync.ma",
      countryCode: "MA",
      facilityId: MOCK_FACILITY_ID,
    });
    await page.goto("/clinical");
    await expect(page.getByText("Salma El Fassi").first()).toBeVisible();
    await expect(page.getByText("Karim Mansouri").first()).toBeVisible();

    const videoSwitch = page.getByRole("switch", { name: /Video Telehealth/i });
    await expect(videoSwitch).toHaveAttribute("aria-checked", "true");
    await videoSwitch.click();
    await expect(videoSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Karim Mansouri")).toHaveCount(0);
    await expect(page.getByText("Salma El Fassi").first()).toBeVisible();
    await videoSwitch.click();
    await expect(videoSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Karim Mansouri").first()).toBeVisible();

    const shiftSwitch = page.getByRole("switch", { name: /Shift Availability/i });
    await expect(shiftSwitch).toHaveAttribute("aria-checked", "true");
    await shiftSwitch.click();
    await expect(shiftSwitch).toHaveAttribute("aria-checked", "false");
    await shiftSwitch.click();
    await expect(shiftSwitch).toHaveAttribute("aria-checked", "true");

    await page.getByRole("tab", { name: /Papers & Licenses/i }).click();
    const feeInput = page.locator("#clinical-practice-fee");
    await expect(feeInput).toHaveValue("350");
    await feeInput.fill("425.50");
    await page.getByRole("button", { name: /Save Practice Details/i }).click();
    await expect.poll(() => capturedFeeMinor).toBe(42550);

    expect(consoleErrors).toEqual([]);
  });

  test("regression & 390px mobile RTL audit: multi-class CDS + override reset, /clinical handler guard & decimal vitals/fees, pharmacist validation, and INTL OPS_ADMIN /profile", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const PROD_ID = "57575757-5757-4575-8575-575757575757";
    const todayDate = new Date().toISOString().slice(0, 10);
    let activeUser = {
      id: MOCK_DOCTOR_ID,
      email: "dr.berrada@medisync.ma",
      fullName: "Dr. Youssef Berrada",
      role: "DOCTOR",
      countryCode: "MA",
      facilityId: MOCK_FACILITY_ID as string | null,
      avatarUrl: null as string | null,
      emailVerified: true,
      phone: "+212600000111",
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      lastLoginAtIso: "2026-11-22T09:00:00.000Z",
      createdAtIso: "2026-11-22T09:00:00.000Z",
    };

    const setActiveSession = async (patch: Partial<typeof activeUser>) => {
      activeUser = { ...activeUser, ...patch };
      await page.addInitScript((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, activeUser);
      await page.evaluate((userObj) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({ token: "test-jwt", user: userObj }),
        );
      }, activeUser);
    };

    const switchLocale = async (target: "English" | "Français" | "العربية") => {
      await page
        .getByRole("button", { name: /Open navigation|Ouvrir le menu|فتح القائمة/i })
        .click();
      const langGroup = page.getByRole("group", {
        name: "Interface language selector",
      });
      await langGroup.getByRole("button", { name: new RegExp(target, "i") }).click();
      await page
        .getByRole("button", { name: /Close menu|Fermer le menu|إغلاق القائمة/i })
        .click();
    };

    const assertNoHorizontalOverflow = async (label: string) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `Horizontal overflow on ${label}`).toBeLessThanOrEqual(1);
    };

    await seedSession(page, {
      id: activeUser.id,
      role: activeUser.role,
      fullName: activeUser.fullName,
      email: activeUser.email,
      countryCode: activeUser.countryCode,
      facilityId: activeUser.facilityId,
    });
    await mockCommonMoroccoNetwork(page);

    let rxPostCount = 0;
    let capturedTempC: number | null = null;
    let skuCreateCount = 0;

    await page.route("**/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: activeUser }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/facilities/*/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }),
    );
    await page.route("**/v1/clinical/patients/*/profile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            userId: MOCK_PATIENT_ID,
            fullName: "Salma El Fassi",
            countryCode: "MA",
            dateOfBirth: "1992-05-14",
            biologicalSex: "FEMALE",
            bloodType: "A+",
            nationalHealthId: "MA-CNOPS-9981",
            emergencyContactName: "Nadia El Fassi",
            emergencyContactPhone: "+212600000888",
            heightCm: 165,
            weightKg: 60,
            allergies: [
              { allergen: "Penicillin", reaction: "Anaphylaxis", severity: "SEVERE" },
              { allergen: "Aspirin", reaction: "Bronchospasm", severity: "MODERATE" },
              { allergen: "Sulfa", reaction: "Rash", severity: "MODERATE" },
              { allergen: "Macrolide", reaction: "Urticaria", severity: "MILD" },
            ],
            chronicConditions: [],
            currentMedications: [],
            primaryDoctorUserId: MOCK_DOCTOR_ID,
            preferredFacilityId: MOCK_FACILITY_ID,
            dataSharingConsent: true,
            telehealthConsent: true,
            updatedAtIso: "2026-11-22T09:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/v1/clinical/visit-notes*", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as {
          vitals?: { temperatureC?: number };
          icd10Codes: string[];
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
        };
        capturedTempC = body.vitals?.temperatureC ?? null;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            visitNote: {
              id: "12121212-1212-4121-8121-121212121212",
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              facilityId: MOCK_FACILITY_ID,
              appointmentId: null,
              icd10Codes: body.icd10Codes,
              subjective: body.subjective,
              objective: body.objective,
              assessment: body.assessment,
              plan: body.plan,
              vitals: body.vitals ?? null,
              createdAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ visitNotes: [] }),
      });
    });
    await page.route("**/v1/clinical/prescriptions*", async (route) => {
      if (route.request().method() === "POST") {
        rxPostCount += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            prescription: {
              id: MOCK_RX_ID,
              countryCode: "MA",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              facilityId: MOCK_FACILITY_ID,
              medications: [],
              notes: null,
              qrToken: "medisync-rx-guard-test",
              qrSignature: "sig",
              status: "ISSUED",
              dispensedByUserId: null,
              pharmacyFacilityId: null,
              dispensedAtIso: null,
              dispensingNote: null,
              issuedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prescriptions: [] }),
      });
    });
    await page.route("**/v1/clinical/lab-orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ labOrders: [] }) }),
    );
    await page.route("**/v1/clinical/media*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mediaObjects: [] }) }),
    );
    await page.route("**/v1/directory/doctors*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          doctors: [
            {
              id: MOCK_DOCTOR_ID,
              fullName: "Dr. Youssef Berrada",
              email: "dr.berrada@medisync.ma",
              countryCode: "MA",
              specialty: "Cardiology",
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              consultationFeeMinor: 42550,
              credentialVerified: true,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/booking/profiles*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profiles: [
            {
              userId: MOCK_DOCTOR_ID,
              fullName: "Dr. Youssef Berrada",
              countryCode: "MA",
              specialty: "Cardiology",
              licenseNumber: "MA-MD-48210",
              consultationFeeMinor: 42550,
              facilityId: MOCK_FACILITY_ID,
              updatedAtIso: "2026-11-22T08:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/booking/schedules*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: [] }) }),
    );
    await page.route("**/v1/booking/appointments*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointments: [
            {
              id: MOCK_APPT_ID,
              countryCode: "MA",
              scheduleId: MOCK_SCHEDULE_ID,
              facilityId: MOCK_FACILITY_ID,
              facilityName: "CHU Ibn Rochd",
              doctorUserId: MOCK_DOCTOR_ID,
              doctorName: "Dr. Youssef Berrada",
              specialty: "Cardiology",
              patientUserId: MOCK_PATIENT_ID,
              patientName: "Salma El Fassi",
              bookedByUserId: MOCK_PATIENT_ID,
              visitMode: "TELEHEALTH",
              slotStartIso: `${todayDate}T10:00:00.000Z`,
              slotEndIso: `${todayDate}T10:30:00.000Z`,
              status: "CONFIRMED",
              reason: "Follow-up",
              triageNote: null,
              createdAtIso: "2026-11-22T09:00:00.000Z",
              updatedAtIso: "2026-11-22T09:00:00.000Z",
            },
          ],
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/presence`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participant: {
            userId: MOCK_DOCTOR_ID,
            role: "DOCTOR",
            fullName: "Dr. Youssef Berrada",
            joined: true,
            audioEnabled: false,
            videoEnabled: false,
            updatedAtIso: new Date().toISOString(),
          },
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/signal`, (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          signal: {
            seq: 1,
            appointmentId: MOCK_APPT_ID,
            senderUserId: MOCK_DOCTOR_ID,
            senderRole: "DOCTOR",
            senderName: "Dr. Youssef Berrada",
            kind: "clinical-updated",
            payload: {},
            sentAtIso: new Date().toISOString(),
          },
        }),
      }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}/stream*`, (route) =>
      route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ping\n\n" }),
    );
    await page.route(`**/v1/telehealth/sessions/${MOCK_APPT_ID}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          appointment: {
            id: MOCK_APPT_ID,
            countryCode: "MA",
            scheduleId: MOCK_SCHEDULE_ID,
            facilityId: MOCK_FACILITY_ID,
            facilityName: "CHU Ibn Rochd",
            doctorUserId: MOCK_DOCTOR_ID,
            doctorName: "Dr. Youssef Berrada",
            specialty: "Cardiology",
            patientUserId: MOCK_PATIENT_ID,
            patientName: "Salma El Fassi",
            bookedByUserId: MOCK_PATIENT_ID,
            visitMode: "TELEHEALTH",
            slotStartIso: `${todayDate}T10:00:00.000Z`,
            slotEndIso: `${todayDate}T10:30:00.000Z`,
            status: "CONFIRMED",
            reason: "Video review",
            triageNote: null,
            createdAtIso: "2026-11-22T09:00:00.000Z",
            updatedAtIso: "2026-11-22T09:00:00.000Z",
          },
          selfRole: "DOCTOR",
          participants: [],
          recentSignals: [],
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        }),
      }),
    );
    await page.route("**/v1/pharmacy/orders*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) }),
    );
    await page.route("**/v1/pharmacy/products*", async (route) => {
      if (route.request().method() === "POST") {
        skuCreateCount += 1;
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ product: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          products: [
            {
              id: PROD_ID,
              countryCode: "MA",
              facilityId: MOCK_PHARMACY_ID,
              facilityName: "Pharmacie Al Amal",
              sku: "PAR-500",
              name: "Paracetamol Doliprane 500mg",
              genericName: "Paracetamol",
              category: "OTC_MEDICATION",
              dosageForm: "Tablet",
              strength: "500mg",
              requiresPrescription: false,
              priceMinor: 6000,
              currencyCode: "MAD",
              stockQty: 24,
              isActive: true,
              imageUrl: null,
              createdAtIso: "2026-11-22T08:00:00.000Z",
              updatedAtIso: "2026-11-22T08:00:00.000Z",
            },
          ],
          deliveryFeeMinor: 2500,
        }),
      });
    });

    // 1. Telehealth at 390x844 mobile (EN & AR RTL): multi-class CDS, false-positive guard, override reset, zero overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/consultation/${MOCK_APPT_ID}`);
    await expect(page.locator("#telehealth-icd10")).toBeVisible();
    await assertNoHorizontalOverflow("/consultation/[id] EN 390px");

    const thMed = page.locator("#telehealth-rx-med");
    const thAlert = page.locator("main").getByRole("alert");
    const thSubmit = page.getByRole("button", { name: /Send QR E-Prescription/i });

    // 1-2 char guard & Acéfylline false-positive guard
    await thMed.fill("P");
    await expect(thAlert).toHaveCount(0);
    await thMed.fill("Acéfylline 250mg");
    await expect(thAlert).toHaveCount(0);

    // Multi-class Moroccan brands: NSAID (Advil), Sulfa (Bactrim), Macrolide (Zithromax), Penicillin (Clamoxyl)
    await thMed.fill("Advil 400mg");
    await expect(thAlert).toContainText(/NSAID/i);
    await thMed.fill("Bactrim 400mg");
    await expect(thAlert).toContainText(/Sulfonamide/i);
    await thMed.fill("Zithromax 500mg");
    await expect(thAlert).toContainText(/Macrolide/i);

    // Override invalidation when switching conflicting drugs (Augmentin overridden -> Clamoxyl re-locks)
    await page.getByRole("button", { name: "Augmentin 1g", exact: true }).click();
    await expect(thSubmit).toBeDisabled();
    await thAlert.getByRole("switch").click();
    await expect(thSubmit).toBeEnabled();
    await thMed.fill("Clamoxyl 1g");
    await expect(thAlert).toBeVisible();
    await expect(thSubmit).toBeDisabled();

    // Switch to Arabic RTL at 390x844 and verify Arabic spellings (أوجمنتين, باكتريم, زيثروماكس) + zero overflow
    await switchLocale("العربية");
    await assertNoHorizontalOverflow("/consultation/[id] AR RTL 390px");
    await thMed.fill("أوجمنتين 1غ");
    await expect(thAlert).toContainText(/البنسلين/);
    await thMed.fill("باكتريم");
    await expect(thAlert).toContainText(/السلفوناميد/);
    await thMed.fill("زيثروماكس");
    await expect(thAlert).toContainText(/الماكروليد/);
    await switchLocale("English");

    // 2. /clinical Consultation Desk: early CDS before dosage/freq, Enter handler guard, decimal comma temp, ICD-10 reset, VisualScheduleBuilder stepper
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/clinical");
    await page.getByRole("tab", { name: /Consultation & E-Rx/i }).click();

    // Early CDS triggers on medication name even when dosage/frequency are cleared
    await page.locator("#clin-rx-dosage").fill("");
    await page.locator("#clin-rx-frequency").fill("");
    await page.locator("#clin-rx-med").fill("Clamoxyl 1g");
    await expect(page.locator("main").getByRole("alert")).toContainText(/Penicillin/i);

    // Handler-level CDS guard blocks Enter submit without override
    await page.locator("#clin-rx-dosage").fill("1 tab");
    await page.locator("#clin-rx-frequency").fill("Twice daily");
    await page.locator("#clin-rx-med").press("Enter");
    await page.waitForTimeout(150);
    expect(rxPostCount).toBe(0);

    // Comma decimal temperature "38,5" persists as 38.5 (not 38) and clears ICD-10 after SOAP save
    await page.getByRole("button", { name: /Acute URI \/ Fever/i }).click();
    await expect(page.locator("#clin-icd10")).toHaveValue("J06.9");
    await page.locator("#clin-vital-temp").fill("38,5");
    await page.getByRole("button", { name: /Save Consultation Note/i }).click();
    await expect.poll(() => capturedTempC).toBe(38.5);
    await expect(page.locator("#clin-icd10")).toHaveValue("");

    // VisualScheduleBuilder Practice drawer uses ClinicalStepper (no input[type="number"]) & preserves 425.50 -> +50 -> 475.50
    await page.getByRole("tab", { name: /Clinic Shifts/i }).click();
    await page.getByRole("button", { name: /Specialty & Fee/i }).click();
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
    const schedFeeInput = page.locator("#schedule-practice-fee");
    await expect(schedFeeInput).toHaveValue("425.50");
    await page.getByRole("button", { name: /Increase Consultation Fee/i }).click();
    await expect(schedFeeInput).toHaveValue("475.50");

    // 3. Pharmacist at 390x844 mobile (EN & AR RTL): inline validation + Add SKU blank stock guard + zero overflow
    await setActiveSession({
      id: "77777777-0000-4000-8000-777777777777",
      role: "PHARMACIST",
      fullName: "Dr. Karim Tazi",
      email: "pharmacist@al-amal.ma",
      countryCode: "MA",
      facilityId: MOCK_PHARMACY_ID,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pharmacy");
    await page.getByRole("tab", { name: /Pharmacist Stock Manager/i }).click();
    await page
      .getByRole("button", { name: /Edit stock and price for Paracetamol Doliprane 500mg/i })
      .click();
    await assertNoHorizontalOverflow("/pharmacy inline edit EN 390px");

    const inlineStock = page.locator(`#edit-stock-${PROD_ID}`);
    const inlineSaveBtn = page.getByRole("button", { name: /^Save$/i });
    await inlineStock.fill("");
    await expect(inlineSaveBtn).toBeDisabled();
    await expect(page.locator("main").getByRole("alert")).toContainText(/stock/i);

    await inlineStock.fill("15");
    await page.locator(`#edit-price-${PROD_ID}`).fill("0.05");
    await expect(inlineSaveBtn).toBeDisabled();
    await expect(page.locator("main").getByRole("alert")).toContainText(/0\.10/);

    // Add SKU composer rejects blank stock instead of coercing "" to 0
    await page.getByRole("button", { name: /Add Pharmacy Medication/i }).click();
    await page.getByRole("button", { name: /\+ Doliprane 1000mg/i }).click();
    await page.getByPlaceholder("20").fill("");
    await page.getByRole("button", { name: /Add to Pharmacy Catalog/i }).click();
    await expect(page.getByText(/valid whole-number stock quantity/i)).toBeVisible();
    expect(skuCreateCount).toBe(0);

    await switchLocale("العربية");
    await assertNoHorizontalOverflow("/pharmacy inline edit AR RTL 390px");
    await switchLocale("English");

    // 4. OPS_ADMIN (countryCode: INTL) on /profile resolves Morocco (MA) · MAD · Emergency 141
    await setActiveSession({
      id: "99999999-1111-4111-8111-999999999999",
      role: "OPS_ADMIN",
      fullName: "Global Ops Admin",
      email: "admin@medisync.global",
      countryCode: "INTL",
      facilityId: null,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profile");
    const profileHeader = page.locator("main section").first();
    await expect(profileHeader).toContainText("Morocco");
    await expect(profileHeader).toContainText("(MA)");
    await expect(profileHeader).toContainText("MAD");
    await expect(profileHeader).toContainText("141");
    await expect(profileHeader).not.toContainText("INTL");
    await expect(profileHeader).not.toContainText("112");

    expect(consoleErrors).toEqual([]);
  });
});
