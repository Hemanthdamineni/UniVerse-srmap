module.exports = {
  _icsDate(dateLike) {
    return new Date(dateLike).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  },

  createIcal(eventId) {
    const event = this.eventById.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UniVerse - SRMAP Edition//Events//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@universe-srmap.local`,
      `DTSTAMP:${this._icsDate(nowIso())}`,
      `DTSTART:${this._icsDate(event.startAt)}`,
      `DTEND:${this._icsDate(event.endAt)}`,
      `SUMMARY:${event.title.replace(/\n/g, " ")}`,
      `DESCRIPTION:${event.description.replace(/\n/g, " ")}`,
      `LOCATION:${(event.location.physical || event.location.virtual || "TBA").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return lines.join("\r\n");
  },

  _googleCalendarLink(event) {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${this._icsDate(event.startAt)}/${this._icsDate(event.endAt)}`,
      details: event.description,
      location: event.location.physical || event.location.virtual || "TBA",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  },

  _outlookCalendarLink(event) {
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      startdt: event.startAt,
      enddt: event.endAt,
      subject: event.title,
      body: event.description,
      location: event.location.physical || event.location.virtual || "TBA",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
};
