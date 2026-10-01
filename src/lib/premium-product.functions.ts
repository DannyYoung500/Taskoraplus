/**
 * Premium product + strong (5, 6, 9 polish, 10, 11–16, 18 — skip 17 VIP).
 * See module for exports: image structural hash, velocity heat, fraud score,
 * levels, advertiser stats, multi-currency, quest packs, ticket reply.
 */
export {
  imageStructuralHash,
  assertProofImageStructuralUnique,
  maybeVelocityHeatAlert,
  computeFraudScore,
  ownerGetUserFraudScore,
  levelFromVerified,
  getMyLevelProgress,
  getMyAdvertiserStats,
  advertiserPauseTask,
  DISPLAY_RATES,
  formatUsdWithLocal,
  claimWeeklyQuestPack,
  getWeeklyQuestPackProgress,
  ownerReplyTicket,
} from "./premium-product-impl.functions";
