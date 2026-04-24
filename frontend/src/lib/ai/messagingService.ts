/** Messaging Service — sends real emails/SMS via backend API (SendGrid/Twilio) */
import api from "../api";

export interface SendResult {
  success: boolean;
  provider: string;
  message_id: string | null;
  error: string | null;
}

/**
 * Send an email via SendGrid (through backend).
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  try {
    const res = await api.post<SendResult>("/messaging/email", { to, subject, body });
    return res.data;
  } catch (e: any) {
    console.error("[MessagingService] sendEmail failed:", e);
    return {
      success: false,
      provider: "error",
      message_id: null,
      error: e?.response?.data?.detail || e.message || "Unknown error",
    };
  }
}

/**
 * Send an SMS via Twilio (through backend).
 */
export async function sendSMS(to: string, body: string): Promise<SendResult> {
  try {
    const res = await api.post<SendResult>("/messaging/sms", { to, body });
    return res.data;
  } catch (e: any) {
    console.error("[MessagingService] sendSMS failed:", e);
    return {
      success: false,
      provider: "error",
      message_id: null,
      error: e?.response?.data?.detail || e.message || "Unknown error",
    };
  }
}

/**
 * Normalize a phone number to E.164 format for display.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
