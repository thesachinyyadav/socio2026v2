"use client";

import React, { Suspense } from "react";
import CreateFestForm from "../../_components/CreateFestForm";

export default function CreateFestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading fest form...</div>}>
      <CreateFestForm />
    </Suspense>
  );
}
