import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  CountryPack,
  PharmacyProductSummary,
} from "@medisync/contracts";
import {
  fetchMobilePharmacyCatalog,
  resolveMobileApiBaseUrl,
} from "../services/native-adapters";

export interface PharmacyScreenProps {
  pack: CountryPack;
  user: {
    id: string;
    fullName: string;
    role: string;
    countryCode: string;
  } | null;
}

export function PharmacyScreen({ pack, user }: PharmacyScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<PharmacyProductSummary[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    `Ready to load verified pharmacy catalog for ${pack.name} (${pack.currencyCode}).`,
  );
  const [loading, setLoading] = useState(false);

  async function handleSyncCatalog(): Promise<void> {
    setLoading(true);
    setStatusMessage("Syncing regional pharmacy stock...");
    try {
      const result = await fetchMobilePharmacyCatalog(
        resolveMobileApiBaseUrl(),
        pack.code,
      );
      if (!result.ok || !result.data) {
        setStatusMessage(result.error ?? "Unable to reach pharmacy catalog API.");
        return;
      }
      setProducts(result.data);
      setStatusMessage(
        `Synced ${result.data.length} verified items in ${pack.name} (${pack.currencyCode}).`,
      );
    } catch {
      setStatusMessage("Offline preview mode: API host unreachable on current device.");
    } finally {
      setLoading(false);
    }
  }

  const visibleProducts = products.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.genericName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pharmacy Storefront & Cold Chain</Text>
      <Text style={styles.subtitle}>
        Role: {user?.role ?? "GUEST"} · Region: {pack.name} ({pack.currencyCode})
      </Text>

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Filter medicines by name, SKU, or generic..."
        style={styles.input}
      />

      <Pressable
        onPress={() => {
          void handleSyncCatalog();
        }}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Syncing..." : `Sync ${pack.code} Pharmacy Catalog`}
        </Text>
      </Pressable>

      <Text style={styles.status}>{statusMessage}</Text>

      {visibleProducts.map((product) => (
        <View key={product.id} style={styles.productCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.productTitle}>{product.name}</Text>
            <Text style={styles.priceBadge}>
              {(product.priceMinor / 100).toFixed(2)} {product.currencyCode}
            </Text>
          </View>
          <Text style={styles.metaText}>
            {product.sku} · {product.requiresPrescription ? "Rx Required" : "OTC"} ·
            Stock: {product.stockQty}
          </Text>
          <Text style={styles.facilityText}>{product.facilityName}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  button: {
    backgroundColor: "#0F766E",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    fontSize: 12,
    color: "#334155",
  },
  productCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#F8FAFC",
    gap: 4,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  priceBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F766E",
  },
  metaText: {
    fontSize: 12,
    color: "#475569",
  },
  facilityText: {
    fontSize: 11,
    color: "#64748B",
  },
});
