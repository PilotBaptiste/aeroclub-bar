"use client";
import { useParams } from "next/navigation";
import AeroClubBarV2 from "@/components/AeroClubBarV2";

export default function ClientBarPage() {
  const { slug } = useParams<{ slug: string }>();
  return <AeroClubBarV2 orgSlug={slug} />;
}
