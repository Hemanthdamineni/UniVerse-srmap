import { useEffect, useState } from "react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { fetchSessionProfile } from "../../lib/session";
import { executePipeline, type StudentProfile } from "../../lib/erpTransformers";

function ProfilePage() {
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const data = await fetchSessionProfile();
            if (data) {
                setProfileData(data);
            } else {
                setError('No profile data available');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch profile data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24 }} className="min-h-screen">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Profile Information</h2>
            {loading && <LoadingSpinner message="Loading profile information..." />}
            {error && <p className="text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_20%,transparent)] p-4 rounded-xl border border-[color-mix(in_srgb,var(--error)_40%,transparent)]">Error: {error}</p>}
            {profileData && profileData.TableContent && (() => {
                const pipelineResult = executePipeline("profile", profileData.TableContent);
                if (!pipelineResult?.isValid || !pipelineResult.data) {
                    return <p className="text-[var(--error)]">Failed to validate profile data.</p>;
                }
                const pData = pipelineResult.data as StudentProfile;
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries({
                            "Student Name": pData.studentName,
                            "Register No": pData.registerNo,
                            "DOB": pData.dob,
                            "Gender": pData.gender,
                            "Academic Year": pData.academicYear,
                            "Program": pData.program,
                            "Specialization": pData.specialization,
                            "Section": pData.section,
                            "Current Semester": pData.currentSemester,
                            "Father Name": pData.fatherName,
                            "Mother Name": pData.motherName,
                            "Contact Number": pData.contactNumber,
                            "Email": pData.email
                        }).map(([key, value]) => {
                            if (!value || typeof value !== 'string' || value.trim() === '-' || value.trim() === '' || value === "N/A") return null;
                            
                            return (
                                <div key={key} className="bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">{key}</h3>
                                    <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
            
            {profileData && !profileData.TableContent && (
                <div className="bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Raw Profile Dump</h3>
                    <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(profileData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default ProfilePage;
