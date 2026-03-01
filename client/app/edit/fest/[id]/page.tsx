"use client";
import CreateFestForm from "../../../_components/CreateFestForm";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext"; // Adjust path

interface FestDataForEdit {
  title: string;
  openingDate: string;
  closingDate: string;
  detailedDescription: string;
  department: string[];
  category: string;
  contactEmail: string;
  contactPhone: string;
  eventHeads: { email: string; expiresAt: string | null }[];
  organizingDept: string;
}

const EditPage = () => {
  const params = useParams();
  const festId = params?.id as string;
  const { session } = useAuth();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");
  const [festData, setFestData] = useState<FestDataForEdit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [existingImageFileUrl, setExistingImageFileUrl] = useState<
    string | null
  >(null);
  const [existingBannerFileUrl, setExistingBannerFileUrl] = useState<
    string | null
  >(null);
  const [existingPdfFileUrl, setExistingPdfFileUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (festId && session?.access_token) {
      const fetchFest = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const response = await fetch(
            `${API_URL}/api/fests/${festId}`,
            {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }
          );
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(
              errData.error || `Failed to fetch fest (${response.status})`
            );
          }
          const data = await response.json();
          if (data.fest) {
            // Transform event_heads to new format
            const eventHeadsData = data.fest.event_heads || [];
            const transformedEventHeads = eventHeadsData.map((head: any) => {
              if (typeof head === 'string') {
                return { email: head, expiresAt: null };
              }
              return { email: head.email || '', expiresAt: head.expiresAt || null };
            });

            const fetched: FestDataForEdit = {
              title: data.fest.fest_title || "",
              openingDate: data.fest.opening_date
                ? new Date(data.fest.opening_date).toISOString().split("T")[0]
                : "",
              closingDate: data.fest.closing_date
                ? new Date(data.fest.closing_date).toISOString().split("T")[0]
                : "",
              detailedDescription: data.fest.description || "",
              department: data.fest.department_access || [],
              category: data.fest.category || "",
              contactEmail: data.fest.contact_email || "",
              contactPhone: data.fest.contact_phone || "",
              eventHeads: transformedEventHeads,
              organizingDept: data.fest.organizing_dept || "",
            };
            setFestData(fetched);

            setExistingImageFileUrl(data.fest.fest_image_url || null);
            setExistingBannerFileUrl(data.fest.banner_url || null);
            setExistingPdfFileUrl(data.fest.pdf_url || null);
          } else {
            throw new Error("Fest data not found in response.");
          }
        } catch (e: any) {
          console.error("Error fetching fest data:", e);
          setErrorMessage(`Error fetching fest: ${e.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      fetchFest();
    } else {
      setIsLoading(false);
      if (!festId) {
        setErrorMessage("Fest ID is missing from URL.");
      }
    }
  }, [festId, session]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading fest data...</div>;
  }

  if (errorMessage && !festData) {
    return <div className="p-8 text-center text-red-600">{errorMessage}</div>;
  }

  if (!festData && festId && !isLoading) {
    return (
      <div className="p-8 text-center">
        Fest not found or there was an issue loading its data.
      </div>
    );
  }

  if (!festId) {
    return (
      <div className="p-8 text-center text-red-600">
        Fest ID is missing from URL. Cannot edit fest.
      </div>
    );
  }

  return (
    <CreateFestForm
      title={festData?.title}
      openingDate={festData?.openingDate}
      closingDate={festData?.closingDate}
      detailedDescription={festData?.detailedDescription}
      department={festData?.department}
      category={festData?.category}
      contactEmail={festData?.contactEmail}
      contactPhone={festData?.contactPhone}
      eventHeads={festData?.eventHeads}
      organizingDept={festData?.organizingDept}
      isEditMode={true}
      existingImageFileUrl={existingImageFileUrl}
      existingBannerFileUrl={existingBannerFileUrl}
      existingPdfFileUrl={existingPdfFileUrl}
    />
  );
};

export default EditPage;

