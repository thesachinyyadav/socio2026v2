"use client";

import React, { Suspense } from "react";
import CreateFestForm from "../../_components/CreateFestForm";
import Container from "@/components/Container";

export default function CreateFestPage() {
  return (
    <Container>
      <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading fest form...</div>}>
        <CreateFestForm />
      </Suspense>
    </Container>
  );
}
