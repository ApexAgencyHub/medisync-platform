"use client";

import { useEffect, useState } from "react";
import type {
  FacilityKind,
  PharmacyProductCategory,
  VehicleType,
} from "@medisync/contracts";
import { ZoomIn } from "lucide-react";
import { useImageLightbox } from "./ImageLightboxProvider";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-9 w-9 text-[11px]",
  sm: "h-12 w-12 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-20 w-20 text-lg",
};

const PRODUCT_CATEGORY_IMAGES: Record<PharmacyProductCategory, string> = {
  OTC_MEDICATION: "/media/products/otc-medication.webp",
  PRESCRIPTION_RX: "/media/products/rx-prescription.webp",
  MEDICAL_DEVICE: "/media/products/medical-device.webp",
  WELLNESS_SUPPLEMENT: "/media/products/wellness-supplement.webp",
  PEDIATRIC_CARE: "/media/products/pediatric-care.webp",
  COLD_CHAIN: "/media/products/cold-chain.webp",
};

const FEMALE_DOCTOR_NAMES = [
  "salma",
  "camille",
  "maya",
  "amina",
  "nadia",
  "claire",
  "sophie",
  "fatima",
  "leila",
  "sarah",
  "marie",
  "elena",
];

/** Picks a curated local medical portrait when no custom photo was uploaded yet. */
export function resolveDefaultAvatar(
  name: string,
  role?: string,
  specialty?: string,
): string {
  const lowerName = name.toLowerCase();
  const lowerSpecialty = (specialty ?? "").toLowerCase();
  const normalizedRole = (role ?? "").toUpperCase();

  if (
    lowerSpecialty.includes("nursing") ||
    lowerSpecialty.includes("infirmier") ||
    lowerName.includes("infirmier")
  ) {
    return "/media/avatars/nurse-infirmier.webp";
  }

  if (normalizedRole === "DOCTOR" || lowerName.startsWith("dr.")) {
    const looksFemale = FEMALE_DOCTOR_NAMES.some((n) => lowerName.includes(n));
    return looksFemale
      ? "/media/avatars/doctor-female.webp"
      : "/media/avatars/doctor-male.webp";
  }

  if (normalizedRole === "PHARMACIST") {
    return "/media/avatars/pharmacist.webp";
  }
  if (normalizedRole === "LAB_TECH") {
    return "/media/avatars/lab-tech.webp";
  }
  if (normalizedRole === "DRIVER") {
    return "/media/avatars/driver-ems.webp";
  }
  if (normalizedRole === "HOSPITAL_ADMIN" || normalizedRole === "OPS_ADMIN") {
    return "/media/avatars/doctor-male.webp";
  }

  return "/media/avatars/patient.webp";
}

export function resolveFacilityPicture(kind: FacilityKind | string): string {
  const normalized = kind.toUpperCase();
  if (normalized === "HOSPITAL") {
    return "/media/facilities/hospital-hub.webp";
  }
  if (normalized === "PHARMACY") {
    return "/media/facilities/pharmacy-interior.webp";
  }
  return "/media/facilities/clinic-interior.webp";
}

export function resolveVehiclePicture(vehicleType: VehicleType | string): string {
  return vehicleType.toUpperCase() === "MEDICAL_SHUTTLE"
    ? "/media/vehicles/medical-transport-car.webp"
    : "/media/vehicles/ambulance-van.webp";
}

export function resolveProductPicture(
  category: PharmacyProductCategory,
  imageUrl?: string | null,
): string {
  return imageUrl && imageUrl.length > 0
    ? imageUrl
    : PRODUCT_CATEGORY_IMAGES[category];
}

interface EntityAvatarProps {
  name: string;
  role?: string;
  specialty?: string;
  subtitle?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  zoomable?: boolean;
  className?: string;
}

/** Displays a custom S3 avatar or studio portrait with optional click-to-zoom modal inspection. */
export function EntityAvatar({
  name,
  role,
  specialty,
  subtitle,
  avatarUrl,
  size = "md",
  zoomable = true,
  className = "",
}: EntityAvatarProps) {
  const { openImage } = useImageLightbox();
  const defaultSrc = resolveDefaultAvatar(name, role, specialty);
  const preferredSrc = avatarUrl && avatarUrl.length > 0 ? avatarUrl : defaultSrc;
  const [activeSrc, setActiveSrc] = useState(preferredSrc);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setActiveSrc(preferredSrc);
    setFallbackFailed(false);
  }, [preferredSrc]);

  const sizeClass = SIZE_CLASSES[size];

  if (fallbackFailed) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 font-bold text-teal-800 ${sizeClass} ${className}`}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  const imgEl = (
    <img
      src={activeSrc}
      alt={name}
      onError={() => {
        if (activeSrc !== defaultSrc) {
          setActiveSrc(defaultSrc);
        } else {
          setFallbackFailed(true);
        }
      }}
      className={`h-full w-full rounded-full object-cover ${
        zoomable ? "transition-transform duration-150 group-hover:scale-105" : ""
      }`}
    />
  );

  if (!zoomable) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-full border border-teal-200 bg-slate-100 ${sizeClass} ${className}`}
      >
        {imgEl}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        openImage({
          src: activeSrc,
          alt: name,
          title: name,
          ...(subtitle ? { subtitle } : {}),
        })
      }
      aria-label={`View photo of ${name}`}
      title="Click to inspect & zoom"
      className={`group relative shrink-0 cursor-zoom-in overflow-hidden rounded-full border border-teal-200 bg-slate-100 transition hover:border-teal-700 hover:ring-2 hover:ring-teal-700/30 focus:outline-none focus:ring-2 focus:ring-teal-700 ${sizeClass} ${className}`}
    >
      {imgEl}
    </button>
  );
}

interface ProductThumbnailProps {
  name: string;
  category: PharmacyProductCategory;
  subtitle?: string;
  imageUrl?: string | null;
  zoomable?: boolean;
  className?: string;
}

/** Displays a full-frame studio product image with click-to-zoom modal inspection. */
export function ProductThumbnail({
  name,
  category,
  subtitle,
  imageUrl,
  zoomable = true,
  className = "h-52 sm:h-56 w-full",
}: ProductThumbnailProps) {
  const { openImage } = useImageLightbox();
  const defaultSrc = PRODUCT_CATEGORY_IMAGES[category];
  const preferredSrc = resolveProductPicture(category, imageUrl);
  const [activeSrc, setActiveSrc] = useState(preferredSrc);

  useEffect(() => {
    setActiveSrc(preferredSrc);
  }, [preferredSrc]);

  const isCompactThumb =
    className.includes("h-10") ||
    className.includes("h-12") ||
    className.includes("h-14") ||
    className.includes("h-16");

  const imgEl = (
    <img
      src={activeSrc}
      alt={name}
      loading="lazy"
      onError={() => {
        if (activeSrc !== defaultSrc) {
          setActiveSrc(defaultSrc);
        }
      }}
      className={`h-full w-full rounded-xl bg-slate-50/90 object-contain p-1.5 ${
        zoomable ? "transition-transform duration-150 group-hover:scale-[1.03]" : ""
      }`}
    />
  );

  if (!zoomable) {
    return (
      <div
        className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`}
      >
        {imgEl}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        openImage({
          src: activeSrc,
          alt: name,
          title: name,
          ...(subtitle ? { subtitle } : {}),
        })
      }
      aria-label={`Inspect ${name} photo`}
      title="Click to zoom product image"
      className={`group relative block cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-teal-700/60 focus:outline-none focus:ring-2 focus:ring-teal-700 ${className}`}
    >
      {imgEl}
      {!isCompactThumb ? (
        <span className="pointer-events-none absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-xs transition group-hover:border-teal-700 group-hover:text-teal-900">
          <ZoomIn className="h-3 w-3 text-teal-800" aria-hidden="true" />
          <span>Zoom</span>
        </span>
      ) : null}
    </button>
  );
}
