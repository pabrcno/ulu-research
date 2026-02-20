import { env } from "@repo/env/server";
import type { Geolocation } from "@repo/types";

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
}

export async function geolocateIp(ip: string): Promise<Geolocation | null> {
  if (isLocalIp(ip)) return null;

  try {
    const res = await fetch(`${env.GEOLOCATION_API_URL}/${ip}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as IpApiResponse;
    if (data.status !== "success") return null;

    return {
      country_code: data.countryCode,
      country_name: data.country,
      city: data.city || undefined,
      timezone: data.timezone || undefined,
    };
  } catch {
    return null;
  }
}

function isLocalIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "0.0.0.0" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  );
}
