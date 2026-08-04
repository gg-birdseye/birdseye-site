import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { Client } from "@/lib/db/schema";
import {
  CONTRACT_VARIANT_FILENAMES,
  resolveContractVariant,
  type ContractVariant,
} from "@/lib/onboarding/contract-variants";

const DEFAULT_CONTRACT_DOCX_DIR = join("docs", "legal", "contracts");

function resolveExistingPath(...candidates: string[]) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveContractDir(dir: string) {
  if (isAbsolute(dir)) return dir;
  return resolve(process.cwd(), dir);
}

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
    const dir = resolveContractDir(options.contractDocxDir);
    const path = resolveExistingPath(
      join(dir, filename),
      // Fallbacks for local/dev cwd differences
      resolve(process.cwd(), DEFAULT_CONTRACT_DOCX_DIR, filename),
      resolve(process.cwd(), options.contractDocxDir, filename),
    );
    if (!path) {
      throw new Error(
        `Contract template not found for variant "${variant}": ${join(dir, filename)}. Run npm run build:contract-variants.`,
      );
    }
    return path;
  }

  if (options?.legacyContractDocxPath) {
    const legacy = options.legacyContractDocxPath;
    const path = resolveExistingPath(
      isAbsolute(legacy) ? legacy : resolve(process.cwd(), legacy),
      legacy,
    );
    if (!path) {
      throw new Error(
        `Contract template not found: ${legacy}. Run npm run build:contract-variants.`,
      );
    }
    return path;
  }

  const defaultPath = resolveExistingPath(
    resolve(process.cwd(), DEFAULT_CONTRACT_DOCX_DIR, filename),
  );
  if (defaultPath) return defaultPath;

  throw new Error(
    "Contract templates are not configured. Set DOCUSIGN_CONTRACT_DOCX_DIR (recommended) or DOCUSIGN_CONTRACT_DOCX_PATH.",
  );
}
