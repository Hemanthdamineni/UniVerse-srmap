class LmsModerationService {
  computeModerationState(flagCount) {
    const count = Number(flagCount || 0);
    if (count >= 5) return 3;
    if (count >= 2) return 2;
    if (count >= 1) return 1;
    return 0;
  }

  isOutdated(outdatedCount) {
    return Number(outdatedCount || 0) >= 3 ? 1 : 0;
  }
}

module.exports = {
  LmsModerationService,
};
