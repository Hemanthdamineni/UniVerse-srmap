const { randomUUID } = require("crypto");
const { nowIso } = require("./utils");

module.exports = {
  listInterviewSlots({ user }) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_interview_slots 
      ORDER BY date, startTime
    `).all();

    return rows.map(row => ({
      ...row,
      isBooked: Boolean(row.isBooked),
    }));
  },

  createInterviewSlot(data, user) {
    this._ensureAuthenticatedUser(user);
    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_interview_slots (
        id, interviewerId, interviewerName, date, startTime, endTime, duration,
        type, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.userId,
      user.name || "Unknown",
      data.date,
      data.startTime,
      data.endTime,
      data.duration,
      data.type,
      data.notes || "",
      now,
      now
    );

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  updateInterviewSlot(id, data, user) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    
    this.db.prepare(`
      UPDATE career_interview_slots SET
        date = COALESCE(?, date),
        startTime = COALESCE(?, startTime),
        endTime = COALESCE(?, endTime),
        duration = COALESCE(?, duration),
        type = COALESCE(?, type),
        notes = COALESCE(?, notes),
        updatedAt = ?
      WHERE id = ? AND interviewerId = ?
    `).run(
      data.date,
      data.startTime,
      data.endTime,
      data.duration,
      data.type,
      data.notes,
      now,
      id,
      user.userId
    );

    return { updated: true };
  },

  deleteInterviewSlot(id, user) {
    this._ensureAuthenticatedUser(user);
    this.db.prepare("DELETE FROM career_interview_slots WHERE id = ? AND interviewerId = ?").run(id, user.userId);
    return { deleted: true };
  },

  listInterviewBookings({ user }) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_interview_bookings 
      WHERE studentId = ? OR interviewerId = ?
      ORDER BY date, startTime
    `).all(user.userId, user.userId);

    return rows;
  },

  bookInterviewSlot(data, user) {
    this._ensureAuthenticatedUser(user);
    
    // Check if slot exists and is not booked
    const slot = this.db.prepare("SELECT * FROM career_interview_slots WHERE id = ?").get(data.slotId);
    if (!slot) {
      const error = new Error("Interview slot not found");
      error.status = 404;
      throw error;
    }
    if (slot.isBooked) {
      const error = new Error("Interview slot is already booked");
      error.status = 409;
      throw error;
    }

    const id = randomUUID();
    const now = nowIso();
    
    // Book the slot
    this.db.prepare(`
      INSERT INTO career_interview_bookings (
        id, slotId, studentId, studentName, interviewerId, interviewerName,
        date, startTime, endTime, type, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.slotId,
      user.userId,
      user.name || "Unknown",
      slot.interviewerId,
      slot.interviewerName,
      slot.date,
      slot.startTime,
      slot.endTime,
      slot.type,
      data.notes || "",
      now,
      now
    );

    // Mark slot as booked
    this.db.prepare("UPDATE career_interview_slots SET isBooked = 1, bookedBy = ?, bookedByName = ? WHERE id = ?")
      .run(user.userId, user.name || "Unknown", data.slotId);

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  cancelInterviewBooking(bookingId, user) {
    this._ensureAuthenticatedUser(user);
    
    const booking = this.db.prepare("SELECT * FROM career_interview_bookings WHERE id = ?").get(bookingId);
    if (!booking) {
      const error = new Error("Interview booking not found");
      error.status = 404;
      throw error;
    }
    
    if (booking.studentId !== user.userId && booking.interviewerId !== user.userId) {
      const error = new Error("Not authorized to cancel this booking");
      error.status = 403;
      throw error;
    }

    // Delete booking
    this.db.prepare("DELETE FROM career_interview_bookings WHERE id = ?").run(bookingId);
    
    // Free up the slot
    this.db.prepare("UPDATE career_interview_slots SET isBooked = 0, bookedBy = NULL, bookedByName = NULL WHERE id = ?")
      .run(booking.slotId);

    return { cancelled: true };
  }
};
