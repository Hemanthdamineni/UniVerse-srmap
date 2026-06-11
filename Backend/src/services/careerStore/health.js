module.exports = {
  getScraperHealth() {
    return this.db.prepare("SELECT * FROM career_source_health").all();
  },

  getScraperRuns(limit = 10) {
    return this.db.prepare("SELECT * FROM career_scraper_runs ORDER BY startedAt DESC LIMIT ?").all(limit);
  }
};
