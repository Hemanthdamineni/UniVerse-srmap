const { addDaysIso, nowIso } = require("./lmsUtils");

const INTERVALS = [1, 3, 7, 14, 30];

class LmsRevisionScheduler {
  getNextRevision({ previousInterval = 1, previousRepetition = 0, score = 0 }) {
    if (score < 60) {
      return {
        dueDate: addDaysIso(nowIso(), 1),
        interval: 1,
        repetition: 0,
      };
    }

    const repetition = previousRepetition + 1;
    const interval = INTERVALS[Math.min(INTERVALS.length - 1, repetition - 1)] || previousInterval || 30;
    return {
      dueDate: addDaysIso(nowIso(), interval),
      interval,
      repetition,
    };
  }
}

module.exports = {
  LmsRevisionScheduler,
};
