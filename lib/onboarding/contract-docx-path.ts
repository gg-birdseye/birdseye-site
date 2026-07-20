import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@/lib/db/schema";
import {
  CONTRACT_VARIANT_FILENAMES,
  resolveContractVariant,
  type ContractVariant,
} from "@/lib/onboarding/contract-variants";

/**
 * Server-only: resolves the on-disk DOCX path for a client's contract variant.
 * Keep Node fs/path usage out of contract-variant.ts so client components can
 * import the pure helpers safely.
 */
export function resolveContractDocxPath(
  client: Pick<
    Client,
    "travelMobilizationFeeRequired" | "tradeOutElected" | "contractVariant"
  >,
  options?: {
    contractDocxDir?: string;
    legacyContractDocxPath?: string;
  },
) {
  const variant = resolveContractVariant(client);
  const filename = CONTRACT_VARIANT_FILENAMES[variant as ContractVariant];

  if (options?.contractDocxDir) {
    const path = join(options.contractDocxDir, filename);
    if (!existsSync(path)) {
      throw new Error(
        `Contract template not found for variant "${variant}": ${path}. Run npm run build:contract-variants.`,
      );
    }
    return path;
  }

  if (options?.legacyContractDocxPath) {
    return options.legacyContractDocxPath;
  }

  throw new Error(
    "Contract templates are not configured. Set DOCUSIGN_CONTRACT_DOCX_DIR (recommended) or DOCUSIGN_CONTRACT_DOCX_PATH.",
  );
}
