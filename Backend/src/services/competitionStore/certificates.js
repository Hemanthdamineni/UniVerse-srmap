const fs = require("fs");
const path = require("path");
const { nowIso, safeJsonParse } = require("./utils");

module.exports = {
  getCertificateTemplate(eventId, user, roundId = "") {
    const event = this._getEventOrThrow(eventId);
    void event;
    const row = this.db.prepare("SELECT * FROM certificate_templates WHERE eventId = ?").get(eventId);
    if (!row) return null;
    return {
      id: row.eventId,
      eventId: row.eventId,
      roundId: row.roundId || roundId || null,
      templateImagePath: row.templateImagePath,
      fields: safeJsonParse(row.fields, []),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  saveCertificateTemplate(eventId, user, payload) {
    const event = this._getEventOrThrow(eventId);
    this._ensurePermission(user, event, "canEdit");
    const templateImagePath = String(payload?.templateImagePath || "").trim();
    if (!templateImagePath) {
      const error = new Error("Template image is required.");
      error.status = 400;
      throw error;
    }
    const existing = this.db.prepare("SELECT createdAt FROM certificate_templates WHERE eventId = ?").get(eventId);
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO certificate_templates (eventId, roundId, templateImagePath, fields, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(eventId) DO UPDATE SET
           roundId = excluded.roundId,
           templateImagePath = excluded.templateImagePath,
           fields = excluded.fields,
           updatedAt = excluded.updatedAt`
      )
      .run(
        eventId,
        payload?.roundId || null,
        templateImagePath,
        JSON.stringify(Array.isArray(payload?.fields) ? payload.fields : []),
        existing?.createdAt || timestamp,
        timestamp
      );
    return this.getCertificateTemplate(eventId, user, payload?.roundId);
  },

  _buildSimplePdf(lines) {
    const body = lines.map((line) => String(line || "").replace(/[()]/g, "")).join("\\n");
    const stream = `BT /F1 18 Tf 70 760 Td (${body}) Tj ET`;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${object}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  },

  generateCertificates(eventId, roundId, user) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    const leaderboard = this.getLeaderboard(eventId, roundId);
    const generated = [];
    for (const row of leaderboard) {
      const recipients = row.teamMembers?.length ? row.teamMembers : [row.submittedBy];
      for (const recipient of recipients) {
        const fileName = `${eventId}_${roundId}_${recipient}.pdf`;
        const filePath = path.join(this.certificatesDir, fileName);
        const buffer = this._buildSimplePdf([
          "Certificate of Participation",
          `Participant: ${recipient}`,
          `Competition: ${event.title}`,
          `Round: ${roundId}`,
          `Result: ${row.decision || "participated"}`,
          `Score: ${row.totalScore ?? "N/A"}`,
          `Rank: ${row.rank}`,
        ]);
        fs.writeFileSync(filePath, buffer);
        generated.push({
          userId: recipient,
          fileName,
          filePath: `certificates/${fileName}`,
        });
      }
    }
    return { generatedCount: generated.length, certificates: generated };
  },

  getMyCertificate(eventId, roundId, userId) {
    const fileName = `${eventId}_${roundId}_${userId}.pdf`;
    const fullPath = path.join(this.certificatesDir, fileName);
    if (!fs.existsSync(fullPath)) {
      const error = new Error("Certificate not found");
      error.status = 404;
      throw error;
    }
    return { fileName, filePath: `certificates/${fileName}` };
  }
};
