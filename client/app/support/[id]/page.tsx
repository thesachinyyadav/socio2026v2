"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Footer from "../../_components/Home/Footer";
import LoadingIndicator from "../../_components/UI/LoadingIndicator";
import { getSupportArticleById, type SupportArticleDetail } from "../../../lib/api";

const safeText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

const SupportArticleDetailPage = () => {
  const params = useParams();
  const articleId = useMemo(() => {
    const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const parsed = Number.parseInt(safeText(raw), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params?.id]);

  const [article, setArticle] = useState<SupportArticleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadArticle = async () => {
      if (!articleId) {
        if (isMounted) {
          setArticle(null);
          setError("Invalid article link.");
          setIsLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
        }
        const data = await getSupportArticleById(articleId);
        if (!isMounted) return;

        if (!data) {
          setArticle(null);
          setError("This support article could not be found.");
          return;
        }

        setArticle(data);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Unable to load support article right now.";
        setArticle(null);
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadArticle();

    return () => {
      isMounted = false;
    };
  }, [articleId]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="container mx-auto px-4 py-6 max-w-4xl flex-1 w-full">
        <div className="mb-8">
          <Link href="/support" className="text-sm text-[#154CB3] hover:underline">
            ← Back to Support
          </Link>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingIndicator label="Loading article" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            <h1 className="text-xl font-bold mb-2">Unable to open article</h1>
            <p className="text-sm">{error}</p>
          </div>
        ) : article ? (
          <article className="rounded-lg border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#154CB3] font-semibold mb-3">
              {article.category}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-[#063168] mb-4">
              {article.title}
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              {article.read_time_minutes} min read · {article.helpful_count} found this helpful
            </p>
            <div className="text-gray-700 leading-relaxed whitespace-pre-line space-y-4">
              {article.content}
            </div>
          </article>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-700">
            Article not found.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SupportArticleDetailPage;
