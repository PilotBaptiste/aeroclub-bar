import { createAdminClient } from "@/lib/supabase/admin";

export interface SumUpCredentials {
  apiKey: string;
  merchantCode: string;
  readerId: string;
  affiliateKey?: string;
  appId?: string;
}

export async function getSumUpCredentials(orgSlug?: string | null): Promise<SumUpCredentials | null> {
  if (orgSlug) {
    const supabase = createAdminClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("slug", orgSlug)
      .single();

    const s = (org?.settings ?? {}) as Record<string, unknown>;
    if (s.sumupApiKey && s.sumupMerchantCode && s.sumupReaderId) {
      return {
        apiKey: String(s.sumupApiKey),
        merchantCode: String(s.sumupMerchantCode),
        readerId: String(s.sumupReaderId),
        affiliateKey: s.sumupAffiliateKey ? String(s.sumupAffiliateKey) : undefined,
        appId: s.sumupAppId ? String(s.sumupAppId) : undefined,
      };
    }
  }

  const apiKey = process.env.SUMUP_API_KEY;
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  const readerId = process.env.SUMUP_READER_ID;
  if (!apiKey || !merchantCode || !readerId) return null;

  return {
    apiKey,
    merchantCode,
    readerId,
    affiliateKey: process.env.SUMUP_AFFILIATE_KEY,
    appId: process.env.SUMUP_APP_ID,
  };
}
