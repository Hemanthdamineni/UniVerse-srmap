// Profile UI: PageHeader, SectionCard groups, StatusBadge; executePipeline call unchanged.
import { useEffect, useMemo, useState } from "react";
import { fetchSessionProfile } from "../../lib/session";
import { executePipeline, type StudentProfile } from "../../lib/erpTransformers";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { InlineError } from "../../components/ui/InlineError";
import { StatusBadge } from "../../components/ui/StatusBadge";

function ProfilePage() {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessionProfile();
      if (data) setProfileData(data);
      else setError("No profile data available");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile data");
    } finally {
      setLoading(false);
    }
  };

  const pData: StudentProfile | null = useMemo(() => {
    if (!profileData?.TableContent) return null;
    const r = executePipeline("profile", profileData.TableContent);
    if (!r?.isValid || !r.data) return null;
    return r.data as StudentProfile;
  }, [profileData]);

  const headerTitle = pData?.studentName?.trim() || "Profile";
  const headerSubtitle =
    pData?.registerNo && pData.registerNo.trim() && pData.registerNo !== "-"
      ? `Register No. ${pData.registerNo}`
      : undefined;

  return (
    <PageContainer>
      <PageHeader title={headerTitle} subtitle={headerSubtitle} />

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {error && <InlineError message={error} onRetry={fetchProfileData} className="mb-6" />}

      {profileData && profileData.TableContent && !loading && !pData && (
        <InlineError message="Failed to validate profile data." onRetry={fetchProfileData} />
      )}

      {pData && !loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCard title="Personal" className="md:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Student Name", pData.studentName],
                ["DOB", pData.dob],
                ["Gender", pData.gender],
                ["Father Name", pData.fatherName],
                ["Mother Name", pData.motherName],
              ].map(([key, value]) =>
                value && String(value).trim() && String(value).trim() !== "-" ? (
                  <div key={key}>
                    <p className="label-text mb-1">{key}</p>
                    <p className="card-title font-semibold">
                      {String(value)}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          </SectionCard>

          <SectionCard title="Academic">
            <div className="grid grid-cols-1 gap-4">
              {[
                ["Register No", pData.registerNo],
                ["Academic Year", pData.academicYear],
                ["Program", pData.program],
                ["Specialization", pData.specialization],
                ["Section", pData.section],
                ["Current Semester", pData.currentSemester],
              ].map(([key, value]) =>
                value && String(value).trim() && String(value).trim() !== "-" ? (
                  <div key={key}>
                    <p className="label-text mb-1">{key}</p>
                    <p className="card-title font-semibold">{String(value)}</p>
                  </div>
                ) : null
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge status="active" label="Enrolled" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Contact">
            <div className="grid grid-cols-1 gap-4">
              {[
                ["Contact Number", pData.contactNumber],
                ["Email", pData.email],
              ].map(([key, value]) =>
                value && String(value).trim() && String(value).trim() !== "-" ? (
                  <div key={key}>
                    <p className="label-text mb-1">{key}</p>
                    <p className="card-title font-semibold break-all">{String(value)}</p>
                  </div>
                ) : null
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {profileData && !profileData.TableContent && !loading ? (
        <SectionCard title="Raw Profile Dump">
          <pre
            className="body-text max-h-[320px] overflow-x-auto whitespace-pre-wrap text-xs"
            style={{ color: "var(--comp-text-secondary)" }}
          >
            {JSON.stringify(profileData, null, 2)}
          </pre>
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}

export default ProfilePage;
