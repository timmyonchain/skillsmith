import {
  createPublicClient,
  http,
  formatEther,
  isAddress,
  getAddress,
  type Address,
} from "viem";
import { mantle } from "viem/chains";

// Mantle mainnet is chain id 5000. Connect through the RPC URL supplied via
// MANTLE_RPC_URL, falling back to the public endpoint when it is not set.
const RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";

export const mantleClient = createPublicClient({
  chain: mantle, // { id: 5000, ... }
  transport: http(RPC_URL),
});

/**
 * Validate a user-supplied address and return it in checksummed form.
 * Throws a clear error if it is not a well-formed 0x address.
 */
function assertAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(
      `Invalid Ethereum/Mantle address: "${address}". Expected a well-formed 0x-prefixed 20-byte hex address.`,
    );
  }
  return getAddress(address);
}

/**
 * Return the native MNT balance for an address as a human-readable decimal
 * string (e.g. "12.345"), not raw wei.
 */
export async function getMntBalance(address: string): Promise<string> {
  const checksummed = assertAddress(address);
  try {
    const wei = await mantleClient.getBalance({ address: checksummed });
    return formatEther(wei);
  } catch (err) {
    throw new Error(
      `Failed to fetch MNT balance for ${checksummed} from ${RPC_URL}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Return the transaction count (nonce) for an address as a number.
 */
export async function getTxCount(address: string): Promise<number> {
  const checksummed = assertAddress(address);
  try {
    return await mantleClient.getTransactionCount({ address: checksummed });
  } catch (err) {
    throw new Error(
      `Failed to fetch transaction count for ${checksummed} from ${RPC_URL}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
