/** Re-exports premium strong-ops (items 3–10). */
export {
  assertIpFamilyVelocityV2,
  proofPerceptualKeyV2,
  assertProofPerceptualV2,
  assertWithdrawalDualControl,
  assertGeoMethodMatchV2,
} from "@/lib/strong-premium-a.functions";

export {
  runStuckWithdrawalSla,
  ownerRunStuckWithdrawalSla,
  assertReferralFraudGate,
  mintBonusAdSession,
  getBonusAdSession,
  assertBonusAdSessionToken,
  getMaintenanceSwitchesPremium,
  assertNotPaused,
  type KillSwitches,
} from "@/lib/strong-premium-b.functions";
