// BasicInfo grid: label-text + card-title tokens only.
import { sanitizeVisibleText } from "../../components/erp/ErpPrimitives";
import { executePipeline, type StudentProfile } from "../../lib/erp/erpTransformers";
import { EmptyState } from "../../components/ui/Feedback";

function BasicInfo({ profileData }: { profileData: any }) {
  // Check if we have the expected SAP data structure
  if (!profileData) {
    return <EmptyState title="No profile data" description="Profile data is not available." />;
  }

  // Check if we have TableContent (actual scraped structure)
  if (!profileData?.TableContent) {
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
      1: 'lg:col-span-1',
      2: 'lg:col-span-2',
      3: 'lg:col-span-3',
      4: 'lg:col-span-4',
      5: 'lg:col-span-5',
      6: 'lg:col-span-6',
    };
    return spanClasses[span] || 'lg:col-span-1';
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-4">
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
        <div key={`${label}-${idx}`} className={`row-span-1 min-w-0 ${getColSpanClass(span)}`}>
          <p className="label-text">{label}</p>
          <h3 className="card-title break-words font-semibold">{sanitizeVisibleText(value || "N/A")}</h3>
        </div>
      ))}
    </div>
  )
}

export default BasicInfo;
