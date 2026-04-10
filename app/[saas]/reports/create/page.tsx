"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";

export default function CreateReportPage() {
  const { saas } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${saas}/spreadsheet`);
  }, [saas, router]);

  return (
    <Center h="100vh">
      <Loader color="violet" />
    </Center>
  );
}
