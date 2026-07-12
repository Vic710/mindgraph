export const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export const getLocalISOString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const offsetSign = offset > 0 ? '-' : '+';
  const absOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMinutes = String(absOffset % 60).padStart(2, '0');
  
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  const iso = localDate.toISOString();
  return iso.substring(0, iso.length - 1) + `${offsetSign}${offsetHours}:${offsetMinutes}`;
};

export const parseDateSafe = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr.endsWith('Z') || dateStr.includes('+') || (dateStr.includes('-') && dateStr.lastIndexOf('-') > 7)) {
    return new Date(dateStr);
  }
  return new Date(dateStr + 'Z');
};
