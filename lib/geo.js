export function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getStoreConfig() {
  return {
    storeName: process.env.NEXT_PUBLIC_STORE_NAME || "Shell Café",
    latitude: Number(process.env.NEXT_PUBLIC_STORE_LATITUDE || 0),
    longitude: Number(process.env.NEXT_PUBLIC_STORE_LONGITUDE || 0),
    radius: Number(process.env.NEXT_PUBLIC_ALLOWED_RADIUS_METERS || 120)
  };
}
