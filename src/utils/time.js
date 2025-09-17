// Time utility helpers to enforce UTC storage and local display

export function toUTCISOString(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString();
}

export function addMinutesUTC(isoOrDate, minutes) {
  const d = isoOrDate instanceof Date ? new Date(isoOrDate) : new Date(isoOrDate || Date.now());
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function nowUTC() {
  return new Date().toISOString();
}


