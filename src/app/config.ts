/** Shared swap config — imported by both the API route and the UI so the
 *  slippage shown to the user can never drift from what's actually sent. */

export const SLIPPAGE_BPS = 100 // 1%

export const CHAIN_ID = 8453 // Base

/** Base produces a block roughly every 2s; a swap typically lands within
 *  a couple of blocks. Used only for the "Est. time" estimate. */
export const BASE_BLOCK_SECONDS = 2
export const EST_BLOCKS_TO_CONFIRM = 2
