// BasicInfo grid: label-text + card-title tokens only.
import { sanitizeVisibleText } from "../../components/erp/ErpPrimitives";
import { executePipeline, type StudentProfile } from "../../lib/erpTransformers";
import { EmptyState } from "../../components/ui/EmptyState";

function BasicInfo({ profileData }: { profileData: any }) {
  // Check if we have the expected SAP data structure
  if (!profileData) {
    return <EmptyState title="No profile data" description="Profile data is not available." />;
  }

  // Check if we have TableContent (actual scraped structure)
  if (!profileData?.TableContent) {
    console.log('TableContent not found, available keys:', Object.keys(profileData));
    return <EmptyState title="Loading profile data..." description="Table content is being fetched." />;
  }

  // Pipeline execute and validation
  const pipelineResult = executePipeline("profile", profileData.TableContent);
  if (!pipelineResult?.isValid || !pipelineResult.data) {
     return <EmptyState title="No valid profile data" description="The profile pipeline returned no valid data." />;
  }
  
  const profileModel = pipelineResult.data as StudentProfile;

  const getColSpanClass = (span: number) => {
    const spanClasses: Record<number, string> = {
      1: 'col-span-1',
      2: 'col-span-2',
      3: 'col-span-3',
      4: 'col-span-4',
      5: 'col-span-5',
      6: 'col-span-6',
    };
    return spanClasses[span] || 'col-span-1';
  };

  return (
    <>
      {[
        { label: "Name", value: profileModel.studentName, span: 4 },
        { label: "Register No", value: profileModel.registerNo, span: 2 },
        { label: "Semester", value: profileModel.currentSemester, span: 2 },
        { label: "Academic Year", value: profileModel.academicYear, span: 2 },
        { label: "Program", value: profileModel.program, span: 6 },
        { label: "Specialization", value: profileModel.specialization, span: 5 },
        { label: "Section", value: profileModel.section, span: 1 },
        { label: "Father Name", value: profileModel.fatherName, span: 3 },
        { label: "Mother Name", value: profileModel.motherName, span: 3 },
        { label: "Student Contact Number", value: profileModel.contactNumber, span: 2 },
        { label: "Email", value: profileModel.email, span: 4 },
      ].map(({ label, value, span }, idx) => (
        <div key={`${label}-${idx}`} className={`row-span-1 ${getColSpanClass(span)}`}>
          <p className="label-text">{label}</p>
          <h3 className="card-title font-semibold">{sanitizeVisibleText(value || "N/A")}</h3>
        </div>
      ))}
    </>
  )
}

export default BasicInfo;
