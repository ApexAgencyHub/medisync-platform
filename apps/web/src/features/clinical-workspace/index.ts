export { ClinicalWorkspace } from "./components/ClinicalWorkspace";
export { ClinicalConsultationDesk } from "./components/ClinicalConsultationDesk";
export { ClinicalLabsImagingDesk } from "./components/ClinicalLabsImagingDesk";
export { ClinicalPapersPanel } from "./components/ClinicalPapersPanel";
export { DoctorCalendarAgenda } from "./components/DoctorCalendarAgenda";
export { VisualScheduleBuilder } from "./components/VisualScheduleBuilder";
export {
  confirmClinicalMediaUpload,
  createLabOrder,
  createMyPatientInsurance,
  createPrescription,
  createVisitNote,
  dispensePrescription,
  fetchClinicalMedia,
  fetchLabOrders,
  fetchMyPatientProfile,
  fetchPatientMedicalProfile,
  fetchPrescriptions,
  fetchVisitNotes,
  listMyPatientInsurances,
  updateLabOrderStatus,
  updateMyPatientProfile,
  verifyPrescriptionQr,
} from "./api-client";
