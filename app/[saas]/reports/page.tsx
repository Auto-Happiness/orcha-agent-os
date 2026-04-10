"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReportsPage() {
  const { saas } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${saas}/spreadsheet`);
  }, [saas, router]);

  return null;
}
