import { listCountryPacks } from "@medisync/country-packs";
import {
  ConsumerHomeRedirect,
  CountryPackExplorer,
  HomeCareLaunchpad,
  ServicePillarsShowcase,
} from "@/features/platform-overview";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { AppHeader } from "@/shared/ui/AppHeader";

export default function HomePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#0F243E]">
      <AppHeader activeRoute="/" />

      <main className="flex flex-1 flex-col">
        <ConsumerHomeRedirect />
        <HomeCareLaunchpad packs={packs} apiBaseUrl={apiBaseUrl} />
        <ServicePillarsShowcase />
        <CountryPackExplorer packs={packs} />
      </main>
    </div>
  );
}
