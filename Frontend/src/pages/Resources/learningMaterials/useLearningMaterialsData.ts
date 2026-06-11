import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getContentWorkflow,
  getLearningMaterialCatalog,
  getLearningMaterialLibrary,
  getLearningMaterialSubjects,
  listAdminLearningMaterialItems,
  listResourceRecommendations,
  type ContentBulkPreview,
  type ContentHistoryEntry,
  type ContentWorkflowSpec,
  type ResourceCatalogResponse,
  type ResourceLibraryResponse,
  type ResourceRecommendation,
  type ResourceSubjectResponse,
} from "../../../lib/lmsApi";
import { canPreviewResource } from "./constants";
import type { AdminLearningResourceItem } from "./types";

type Options = {
  adminMode: boolean;
  adminUnlocked: boolean;
  adminHeaders: HeadersInit;
  advanced: boolean;
  search: string;
};

export function useLearningMaterialsData({ adminMode, adminUnlocked, adminHeaders, advanced, search }: Options) {
  const [catalog, setCatalog] = useState<ResourceCatalogResponse | null>(null);
  const [subjects, setSubjects] = useState<ResourceSubjectResponse | null>(null);
  const [library, setLibrary] = useState<ResourceLibraryResponse | null>(null);
  const [adminItems, setAdminItems] = useState<AdminLearningResourceItem[]>([]);
  const [workflow, setWorkflow] = useState<ContentWorkflowSpec | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("unpublish");
  const [bulkPreview, setBulkPreview] = useState<ContentBulkPreview | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState("");
  const [historyItems, setHistoryItems] = useState<ContentHistoryEntry[]>([]);
  const [recommendations, setRecommendations] = useState<ResourceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const loadCatalog = useCallback(async (year?: number | null) => {
    const nextCatalog = await getLearningMaterialCatalog(year);
    setCatalog(nextCatalog);
    const nextYear = year ?? nextCatalog.selectedYear ?? nextCatalog.years[0] ?? null;
    setSelectedYear(nextYear);
    const firstCourse =
      nextCatalog.courses.find((course) => (nextYear === null ? true : course.year === nextYear)) ||
      nextCatalog.courses[0] ||
      null;
    setSelectedCourseCode(firstCourse?.courseCode || "");
  }, []);

  const fetchCurrentSelection = useCallback(async () => {
    const [libraryResponse, adminResponse, recommendationResponse] = await Promise.all([
      getLearningMaterialLibrary({
        year: selectedYear!,
        courseCode: selectedCourseCode,
        subjectCode: selectedSubjectCode,
        query: advanced ? search : "",
      }),
      adminMode && adminUnlocked
        ? listAdminLearningMaterialItems(
            {
              year: String(selectedYear),
              courseCode: selectedCourseCode,
              subjectCode: selectedSubjectCode,
              includeDeleted: "true",
            },
            adminHeaders
          )
        : Promise.resolve({ items: [] as AdminLearningResourceItem[] }),
      adminMode && adminUnlocked ? listResourceRecommendations(adminHeaders) : Promise.resolve({ items: [] }),
    ]);

    return { libraryResponse, adminResponse, recommendationResponse };
  }, [
    adminHeaders,
    adminMode,
    adminUnlocked,
    advanced,
    search,
    selectedCourseCode,
    selectedSubjectCode,
    selectedYear,
  ]);

  const refreshCurrentSelection = useCallback(async () => {
    if (!selectedYear || !selectedCourseCode || !selectedSubjectCode) return;
    const { libraryResponse, adminResponse, recommendationResponse } = await fetchCurrentSelection();
    setLibrary(libraryResponse);
    setAdminItems(adminResponse.items);
    setRecommendations(recommendationResponse.items || []);
  }, [fetchCurrentSelection, selectedCourseCode, selectedSubjectCode, selectedYear]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadCatalog()
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError, "Failed to load learning materials."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCatalog]);

  useEffect(() => {
    if (!adminMode || !adminUnlocked) {
      setWorkflow(null);
      setSelectedAdminIds([]);
      setBulkPreview(null);
      return;
    }
    let active = true;
    getContentWorkflow(adminHeaders)
      .then((spec) => {
        if (active) setWorkflow(spec);
      })
      .catch(() => {
        if (active) setWorkflow(null);
      });
    return () => {
      active = false;
    };
  }, [adminHeaders, adminMode, adminUnlocked]);

  useEffect(() => {
    if (!selectedYear || !selectedCourseCode) {
      setSubjects(null);
      setSelectedSubjectCode("");
      return;
    }

    let active = true;
    getLearningMaterialSubjects(selectedYear, selectedCourseCode)
      .then((response) => {
        if (!active) return;
        setSubjects(response);
        setSelectedSubjectCode((current) =>
          current && response.subjects.some((subject) => subject.subjectCode === current)
            ? current
            : (response.subjects[0]?.subjectCode || "")
        );
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError, "Failed to load subject list."));
      });

    return () => {
      active = false;
    };
  }, [selectedCourseCode, selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedCourseCode || !selectedSubjectCode) {
      setLibrary(null);
      setAdminItems([]);
      setPreviewUrl("");
      return;
    }

    let active = true;
    setLibraryLoading(true);
    setError(null);

    fetchCurrentSelection()
      .then(({ libraryResponse, adminResponse, recommendationResponse }) => {
        if (!active) return;
        setLibrary(libraryResponse);
        setAdminItems(adminResponse.items);
        setRecommendations(recommendationResponse.items || []);
        setPreviewUrl(findPreviewUrl(libraryResponse));
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError, "Failed to load selected resources."));
      })
      .finally(() => {
        if (active) setLibraryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchCurrentSelection, selectedCourseCode, selectedSubjectCode, selectedYear]);

  const coursesForYear = useMemo(
    () => (catalog?.courses || []).filter((course) => (selectedYear === null ? true : course.year === selectedYear)),
    [catalog?.courses, selectedYear]
  );
  const selectedCourse = coursesForYear.find((course) => course.courseCode === selectedCourseCode) || null;
  const selectedSubject = subjects?.subjects.find((subject) => subject.subjectCode === selectedSubjectCode) || null;

  return {
    adminItems,
    bulkAction,
    bulkPreview,
    catalog,
    coursesForYear,
    error,
    historyItems,
    historyOpenId,
    library,
    libraryLoading,
    loadCatalog,
    loading,
    previewUrl,
    recommendations,
    refreshCurrentSelection,
    selectedAdminIds,
    selectedCourse,
    selectedCourseCode,
    selectedSubject,
    selectedSubjectCode,
    selectedYear,
    setBulkAction,
    setBulkPreview,
    setHistoryItems,
    setHistoryOpenId,
    setPreviewUrl,
    setSelectedAdminIds,
    setSelectedCourseCode,
    setSelectedSubjectCode,
    setSelectedYear,
    subjects,
    workflow,
  };
}

function findPreviewUrl(libraryResponse: ResourceLibraryResponse) {
  const previewCandidate = libraryResponse.groups
    .flatMap((group) => group.items)
    .flatMap((item) => item.resources)
    .find((resource) => canPreviewResource(resource.urlOrPath, resource.kind));
  return previewCandidate?.urlOrPath || "";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
