export default async function handler(req, res) {
  const sources = [
    process.env.GOOGLE_CALENDAR_ICS_URL,
    process.env.GOOGLE_CALENDAR_ICS_URL_2,
    process.env.GOOGLE_CALENDAR_ICS_URL_3
  ].filter(Boolean);

  if (!sources.length) {
    return res.status(500).json({
      error: "Missing GOOGLE_CALENDAR_ICS_URL environment variable",
      events: []
    });
  }

  try {
    const responses = await Promise.all(
      sources.map((url) =>
        fetch(url, { headers: { "user-agent": "homepage-calendar-widget" } })
      )
    );

    const bad = responses.find((r) => !r.ok);
    if (bad) throw new Error(`ICS fetch failed with status ${bad.status}`);

    const texts = await Promise.all(responses.map((r) => r.text()));
    const now = new Date();
    const inSevenDays = new Date(now);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const events = texts
      .flatMap((text, index) => parseICS(text, `Agenda ${index + 1}`))
      .filter((event) => {
        const start = new Date(event.start);
        const end = new Date(event.end || event.start);
        return end >= now && start <= inSevenDays;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 24);

    return res.status(200).json({ events });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Calendar fetch failed",
      events: []
    });
  }
}

function parseICS(text, sourceName) {
  const normalized = text.replace(/\r\n[ \t]/g, "");
  const blocks = normalized.split("BEGIN:VEVENT").slice(1);
  const events = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0] || "";
    const title = readField(body, "SUMMARY");
    const description = readField(body, "DESCRIPTION");
    const url = readField(body, "URL");
    const location = readField(body, "LOCATION");
    const startRaw = readField(body, "DTSTART");
    const endRaw = readField(body, "DTEND");

    if (!startRaw) continue;

    const start = parseICSDate(startRaw);
    const end = endRaw ? parseICSDate(endRaw) : null;
    const allDay = !startRaw.includes("T");

    if (!start) continue;

    events.push({
      title: title || "Événement",
      description: description || "",
      url: url || "",
      location: location || "",
      source: sourceName,
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      allDay
    });
  }

  return events;
}

function readField(block, name) {
  const regex = new RegExp(`^${name}(?:;[^:]+)?:([^\\n\\r]+)$`, "m");
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function parseICSDate(value) {
  if (!value) return null;

  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    return new Date(y, m, d, 0, 0, 0);
  }

  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    const hh = Number(value.slice(9, 11));
    const mm = Number(value.slice(11, 13));
    const ss = Number(value.slice(13, 15));
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }

  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6)) - 1;
    const d = Number(value.slice(6, 8));
    const hh = Number(value.slice(9, 11));
    const mm = Number(value.slice(11, 13));
    const ss = Number(value.slice(13, 15));
    return new Date(y, m, d, hh, mm, ss);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
